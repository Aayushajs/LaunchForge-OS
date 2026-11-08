# 11. API and automation

Everything the dashboard does is available over the API. Full reference: [API documentation](../05-api/API_DOCUMENTATION.md); interactive explorer at `/swagger` on your installation.

## Authenticate

Create a key under **Settings → Profile → API Keys** and send it as `x-api-key`:

```bash
export LF=https://deploy.example.com
export KEY=lf_xxxxxxxxxxxxxxxx

curl -s "$LF/api/project.all" -H "x-api-key: $KEY" | jq '.[].name'
```

## Deploy from CI

```bash
curl -s -X POST "$LF/api/application.deploy" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"applicationId": "<id from the application URL>"}'
```

### GitHub Actions

```yaml
- name: Deploy to LaunchForge
  run: |
    curl -fsS -X POST "${{ secrets.LF_URL }}/api/application.deploy" \
      -H "x-api-key: ${{ secrets.LF_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"applicationId": "${{ secrets.LF_APP_ID }}"}'
```

## Deploy webhooks

Every application and compose service has a webhook URL (**Deployments** tab):

```text
POST https://deploy.example.com/api/deploy/<token>
```

- POST only. Any other method returns 405.
- Optional signing: set the Git host's webhook secret to the same `<token>`. GitLab sends it as `X-Gitlab-Token`; Gitea, GitHub and Bitbucket sign the body with HMAC-SHA256. A delivery with a wrong signature is rejected with 401.
- Branch, tag and watch-path filters apply; `[skip ci]` in the commit message skips the deployment.
- Docker Hub and GHCR "image pushed" events redeploy services that use that image.

Rotate the token from the same tab if it leaks.

## tRPC

The dashboard itself uses tRPC at `/api/trpc/<router>.<procedure>`; inputs are superjson-encoded. Prefer the REST endpoints for scripts.
