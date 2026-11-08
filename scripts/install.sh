#!/usr/bin/env bash
# LaunchForge installer.
#
#   curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash
#
# Commands: install (default), upgrade, uninstall, status
# Options:
#   --version <tag>          image tag to install (default: latest, or edge)
#   --image <repo>           image repository (default: ghcr.io/aayushajs/launchforge)
#   --advertise-addr <ip>    address Swarm advertises (default: auto-detected)
#   --port <port>            dashboard port (default: 3000)
#   --yes                    do not ask for confirmation
#   --purge                  with uninstall: also delete volumes and /etc/dokploy
set -Eeuo pipefail

IMAGE_REPO="${LAUNCHFORGE_IMAGE:-ghcr.io/aayushajs/launchforge}"
VERSION="${LAUNCHFORGE_VERSION:-latest}"
PANEL_PORT="${LAUNCHFORGE_PORT:-3000}"
ADVERTISE_ADDR="${ADVERTISE_ADDR:-}"
ASSUME_YES=0
PURGE=0
COMMAND="install"

# Internal resource names are shared with the panel code and must not change.
NETWORK="dokploy-network"
PANEL_SERVICE="dokploy"
POSTGRES_SERVICE="dokploy-postgres"
TRAEFIK_CONTAINER="dokploy-traefik"
BASE_PATH="/etc/dokploy"
POSTGRES_IMAGE="postgres:16"
TRAEFIK_IMAGE="traefik:v${TRAEFIK_VERSION:-3.7.16}"
SECRET_PG="launchforge_postgres_password"
SECRET_AUTH="launchforge_auth_secret"
SECRET_ENC="launchforge_encryption_key"
MIN_MEMORY_MB="${LAUNCHFORGE_MIN_MEMORY_MB:-1800}"
MIN_DISK_GB="${LAUNCHFORGE_MIN_DISK_GB:-20}"
HEALTH_TIMEOUT=300

if [ -t 1 ]; then
	BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
	BOLD=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

info() { printf '%s==>%s %s\n' "$BOLD" "$RESET" "$*"; }
ok() { printf '%s✔%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die() { printf '%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

trap 'die "Installer failed on line $LINENO. Nothing after this step was changed; re-running is safe."' ERR

usage() {
	cat <<'USAGE'
Usage: install.sh [install|upgrade|uninstall|status] [options]

  --version <tag>         image tag to install (default: latest, or edge)
  --image <repo>          image repository (default: ghcr.io/aayushajs/launchforge)
  --advertise-addr <ip>   address Swarm advertises (default: auto-detected)
  --port <port>           dashboard port (default: 3000)
  --yes                   do not ask for confirmation
  --purge                 with uninstall: also delete volumes and /etc/dokploy
USAGE
}

parse_args() {
	while [ $# -gt 0 ]; do
		case "$1" in
			install|upgrade|uninstall|status) COMMAND="$1" ;;
			--version) VERSION="${2:?--version needs a value}"; shift ;;
			--image) IMAGE_REPO="${2:?--image needs a value}"; shift ;;
			--advertise-addr) ADVERTISE_ADDR="${2:?--advertise-addr needs a value}"; shift ;;
			--port) PANEL_PORT="${2:?--port needs a value}"; shift ;;
			--yes|-y) ASSUME_YES=1 ;;
			--purge) PURGE=1 ;;
			-h|--help) usage; exit 0 ;;
			*) die "Unknown option: $1 (see --help)" ;;
		esac
		shift
	done
	IMAGE="${IMAGE_REPO}:${VERSION}"
}

confirm() {
	[ "$ASSUME_YES" -eq 1 ] && return 0
	local reply
	if [ -r /dev/tty ]; then
		read -r -p "$1 [y/N] " reply </dev/tty
	else
		die "Refusing to continue without a terminal; pass --yes to confirm."
	fi
	[[ "$reply" =~ ^[Yy]$ ]]
}

require_root() {
	[ "$(id -u)" -eq 0 ] || die "Run as root (for example: curl ... | sudo bash)."
}

preflight() {
	info "Checking this server"
	[ "$(uname -s)" = "Linux" ] || die "LaunchForge needs Linux."
	case "$(uname -m)" in
		x86_64|amd64|aarch64|arm64) ;;
		*) die "Unsupported CPU architecture: $(uname -m) (need x86_64 or arm64)." ;;
	esac
	if [ -f /.dockerenv ] || grep -qa 'container=' /proc/1/environ 2>/dev/null; then
		die "Install on the host, not inside a container."
	fi
	if [ -r /etc/os-release ]; then
		# shellcheck disable=SC1091
		. /etc/os-release
		case "${ID:-}" in
			ubuntu|debian) ok "OS: ${PRETTY_NAME:-$ID}" ;;
			*) warn "Untested OS ${PRETTY_NAME:-unknown}; Ubuntu 22.04/24.04 and Debian 12 are supported." ;;
		esac
	fi
	local memory_mb disk_gb
	memory_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
	[ "$memory_mb" -ge "$MIN_MEMORY_MB" ] || die "At least 2 GB of RAM is required (found ${memory_mb} MB)."
	ok "Memory: ${memory_mb} MB"
	mkdir -p /var/lib
	disk_gb=$(df -Pk /var/lib | awk 'NR==2 {print int($4/1024/1024)}')
	[ "$disk_gb" -ge "$MIN_DISK_GB" ] || die "At least ${MIN_DISK_GB} GB free disk is required (found ${disk_gb} GB)."
	ok "Free disk: ${disk_gb} GB"
	for port in 80 443 "$PANEL_PORT"; do
		if port_in_use "$port" && ! owned_by_launchforge "$port"; then
			die "Port $port is already in use. Free it or choose another dashboard port with --port."
		fi
	done
	ok "Ports 80, 443 and ${PANEL_PORT} are available"
}

port_in_use() {
	if command -v ss >/dev/null 2>&1; then
		ss -Htln "sport = :$1" 2>/dev/null | grep -q .
	else
		(echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
	fi
}

owned_by_launchforge() {
	command -v docker >/dev/null 2>&1 || return 1
	docker ps --format '{{.Names}}' 2>/dev/null | grep -Eq "^(${TRAEFIK_CONTAINER}|${PANEL_SERVICE}\.)"
}

install_docker() {
	if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
		ok "Docker $(docker version --format '{{.Server.Version}}') is installed"
		return
	fi
	info "Installing Docker"
	curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
	sh /tmp/get-docker.sh
	rm -f /tmp/get-docker.sh
	systemctl enable --now docker >/dev/null 2>&1 || true
	docker info >/dev/null 2>&1 || die "Docker was installed but is not running."
	ok "Docker installed"
}

detect_advertise_addr() {
	[ -n "$ADVERTISE_ADDR" ] && return
	ADVERTISE_ADDR=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<NF;i++) if ($i=="src") {print $(i+1); exit}}')
	[ -n "$ADVERTISE_ADDR" ] || ADVERTISE_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
	[ -n "$ADVERTISE_ADDR" ] || die "Could not detect this server's IP; pass --advertise-addr."
}

init_swarm() {
	if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" = "active" ]; then
		ok "Docker Swarm is already active"
		return
	fi
	detect_advertise_addr
	info "Initializing Docker Swarm on ${ADVERTISE_ADDR}"
	docker swarm init --advertise-addr "$ADVERTISE_ADDR" >/dev/null
	ok "Swarm initialized"
}

create_network() {
	if docker network inspect "$NETWORK" >/dev/null 2>&1; then
		ok "Network ${NETWORK} exists"
		return
	fi
	docker network create --driver overlay --attachable "$NETWORK" >/dev/null
	ok "Network ${NETWORK} created"
}

random_secret() { openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

ensure_secret() {
	if docker secret inspect "$1" >/dev/null 2>&1; then
		ok "Secret $1 exists"
		return
	fi
	random_secret | docker secret create "$1" - >/dev/null
	ok "Secret $1 generated"
}

create_secrets() {
	info "Preparing secrets"
	ensure_secret "$SECRET_PG"
	ensure_secret "$SECRET_AUTH"
	ensure_secret "$SECRET_ENC"
}

start_postgres() {
	if docker service inspect "$POSTGRES_SERVICE" >/dev/null 2>&1; then
		ok "Database service exists"
		return
	fi
	info "Starting the database"
	docker service create --detach --name "$POSTGRES_SERVICE" \
		--constraint 'node.role==manager' \
		--network "$NETWORK" \
		--env POSTGRES_USER=dokploy \
		--env POSTGRES_DB=dokploy \
		--env POSTGRES_PASSWORD_FILE="/run/secrets/${SECRET_PG}" \
		--secret "$SECRET_PG" \
		--mount type=volume,source=dokploy-postgres,target=/var/lib/postgresql/data \
		"$POSTGRES_IMAGE" >/dev/null
	ok "Database service created"
}

pull_image() {
	if [ "${LAUNCHFORGE_SKIP_PULL:-0}" = "1" ] && docker image inspect "$IMAGE" >/dev/null 2>&1; then
		ok "Using local image ${IMAGE}"
		return
	fi
	info "Pulling ${IMAGE}"
	docker pull "$IMAGE" >/dev/null || {
		[ "$VERSION" = "latest" ] || die "Could not pull ${IMAGE}."
		warn "No stable release yet; falling back to the edge build."
		VERSION="edge"; IMAGE="${IMAGE_REPO}:${VERSION}"
		docker pull "$IMAGE" >/dev/null || die "Could not pull ${IMAGE}."
	}
	ok "Image ready"
}

bootstrap_host() {
	# Recreating a running Traefik would drop live traffic and collide with its
	# own endpoint on the overlay network; the dashboard manages it from here on.
	if [ -n "$(docker ps -q --filter "name=^${TRAEFIK_CONTAINER}$" --filter status=running)" ]; then
		ok "Traefik is running"
		return
	fi
	info "Configuring the reverse proxy"
	mkdir -p "$BASE_PATH"
	docker pull "$TRAEFIK_IMAGE" >/dev/null
	# The bootstrap never touches the database or sessions; placeholder values
	# keep the modules it imports from warning about missing secrets.
	docker run --rm \
		--network "$NETWORK" \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v "${BASE_PATH}:${BASE_PATH}" \
		-e DATABASE_URL=postgres://bootstrap@127.0.0.1:1/unused \
		-e BETTER_AUTH_SECRET=bootstrap-unused \
		"$IMAGE" node dist/bootstrap.mjs
	ok "Traefik is running"
}

start_panel() {
	if docker service inspect "$PANEL_SERVICE" >/dev/null 2>&1; then
		ok "Dashboard service exists"
		return
	fi
	info "Starting the dashboard"
	docker service create --detach --name "$PANEL_SERVICE" \
		--replicas 1 \
		--constraint 'node.role==manager' \
		--network "$NETWORK" \
		--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
		--mount type=bind,source="$BASE_PATH",target="$BASE_PATH" \
		--mount type=volume,source=dokploy,target=/root/.docker \
		--secret "$SECRET_PG" --secret "$SECRET_AUTH" --secret "$SECRET_ENC" \
		--env POSTGRES_PASSWORD_FILE="/run/secrets/${SECRET_PG}" \
		--env BETTER_AUTH_SECRET_FILE="/run/secrets/${SECRET_AUTH}" \
		--env ENCRYPTION_KEY_FILE="/run/secrets/${SECRET_ENC}" \
		--publish "published=${PANEL_PORT},target=3000,mode=host" \
		--update-order stop-first \
		--update-failure-action rollback \
		--rollback-order stop-first \
		"$IMAGE" >/dev/null
	ok "Dashboard service created"
}

wait_healthy() {
	info "Waiting for the dashboard to become healthy (up to ${HEALTH_TIMEOUT}s)"
	local deadline=$((SECONDS + HEALTH_TIMEOUT))
	while [ "$SECONDS" -lt "$deadline" ]; do
		if curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
			ok "Dashboard is healthy"
			return 0
		fi
		sleep 3
	done
	return 1
}

public_ip() {
	curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo "${ADVERTISE_ADDR:-<server-ip>}"
}

cmd_install() {
	require_root
	preflight
	install_docker
	init_swarm
	create_network
	create_secrets
	start_postgres
	pull_image
	bootstrap_host
	start_panel
	wait_healthy || die "The dashboard did not start. Inspect it with: docker service logs ${PANEL_SERVICE}"
	printf '\n%sLaunchForge is installed.%s\n' "$GREEN$BOLD" "$RESET"
	printf 'Open http://%s:%s to create the owner account.\n' "$(public_ip)" "$PANEL_PORT"
	printf 'Add a domain for the dashboard under Settings > Web Server to get HTTPS.\n'
}

backup_database() {
	local dir="${BASE_PATH}/backups" stamp container file
	mkdir -p "$dir"
	stamp=$(date -u +%Y%m%dT%H%M%SZ)
	file="${dir}/pre-upgrade-${stamp}.sql.gz"
	container=$(docker ps -q -f "name=${POSTGRES_SERVICE}\." | head -1)
	[ -n "$container" ] || die "Database container is not running; refusing to upgrade without a backup."
	docker exec "$container" pg_dump -U dokploy dokploy | gzip >"$file"
	[ -s "$file" ] || die "Database backup is empty; refusing to upgrade."
	ok "Database backed up to ${file}"
}

cmd_upgrade() {
	require_root
	docker service inspect "$PANEL_SERVICE" >/dev/null 2>&1 || die "LaunchForge is not installed here."
	local current
	current=$(docker service inspect "$PANEL_SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
	info "Current image: ${current%@*}"
	pull_image
	backup_database
	info "Upgrading to ${IMAGE}"
	docker service update --detach --image "$IMAGE" --with-registry-auth "$PANEL_SERVICE" >/dev/null
	sleep 5
	if wait_healthy; then
		ok "Upgraded to ${IMAGE}"
	else
		warn "The new version is not healthy; rolling back to ${current%@*}"
		docker service rollback "$PANEL_SERVICE" >/dev/null || docker service update --detach --image "${current%@*}" "$PANEL_SERVICE" >/dev/null
		wait_healthy || die "Rollback did not recover the dashboard; restore the backup in ${BASE_PATH}/backups."
		die "Upgrade failed and was rolled back. Your data was not changed."
	fi
}

cmd_uninstall() {
	require_root
	confirm "Remove LaunchForge services from this server?" || die "Aborted."
	docker service rm "$PANEL_SERVICE" "$POSTGRES_SERVICE" >/dev/null 2>&1 || true
	docker rm -f "$TRAEFIK_CONTAINER" >/dev/null 2>&1 || true
	docker secret rm "$SECRET_PG" "$SECRET_AUTH" "$SECRET_ENC" >/dev/null 2>&1 || true
	if [ "$PURGE" -eq 1 ]; then
		confirm "Also delete all LaunchForge data (database volume and ${BASE_PATH})?" || die "Aborted."
		sleep 5
		docker volume rm dokploy-postgres dokploy >/dev/null 2>&1 || true
		docker network rm "$NETWORK" >/dev/null 2>&1 || true
		rm -rf "$BASE_PATH"
		ok "LaunchForge and its data were removed"
	else
		ok "LaunchForge services removed; data volumes and ${BASE_PATH} were kept (use --purge to delete them)"
	fi
}

cmd_status() {
	docker service ls --filter "name=${PANEL_SERVICE}" --filter "name=${POSTGRES_SERVICE}"
	docker ps --filter "name=${TRAEFIK_CONTAINER}" --format 'table {{.Names}}\t{{.Status}}'
	if curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
		ok "Dashboard healthy on port ${PANEL_PORT}"
	else
		warn "Dashboard is not responding on port ${PANEL_PORT}"
	fi
}

main() {
	parse_args "$@"
	case "$COMMAND" in
		install) cmd_install ;;
		upgrade) cmd_upgrade ;;
		uninstall) cmd_uninstall ;;
		status) cmd_status ;;
	esac
}

main "$@"
