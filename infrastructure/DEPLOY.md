# C1Pay Kubernetes Deployment Guide

## Architecture Overview

```
                    ┌──────────────────────┐
                    │  Traefik Ingress     │
                    │  (Mesh / Edge Router)│
                    └──────────┬───────────┘
                               │ HTTPS (TLS via cert-manager)
                    ┌──────────▼───────────┐
                    │  EKS Cluster          │
                    │                       │
   ┌────────────────┼──────────────────────┤
   │                │                      │
   ▼                ▼                      ▼
┌────────┐    ┌─────────┐          ┌──────────────┐
│ ArgoCD │    │ c1pay   │          │ AWS RDS      │
│ (GitOps)│    │ deploy  │─────────▶│ PostgreSQL   │
│        │◀───│ ingresses│          └──────────────┘
│        │    │         │
└────────┘    └─────────┘
```

- **ArgoCD** watches `argocd/base/` in the repo and syncs K8s resources
- **ImageUpdater** annotation on the Application CRD pushes new images to ECR → ArgoCD picks up image changes automatically
- **Ingress** via Traefik v2 with HTTPS termination (cert-manager + Let's Encrypt)

## Prerequisites

```bash
# AWS CLI configured with credentials that have EKS and ECR access
aws sts get-caller-identity

# kubectl configured for the target cluster
aws eks update-kubeconfig --name <cluster-name> --region us-east-1

# Helm 3+ installed
helm version
```

## One-time cluster setup

Run these scripts in order after you've forked/updated them with real values:

```bash
chmod +x infrastructure/*.sh

# 1. Create EKS cluster (takes ~20 min)
infrastructure/create-eks.sh c1pay-prod us-east-1

# 2. Install Traefik as the ingress controller
helm repo add traefik https://traefik.github.io/charts
helm install traefik traefik/traefik \
  --namespace=traefik --create-namespace \
  --set metrics.prometheus=true \
  --set logs.general.level=INFO
```

## Secrets management

Secrets must be populated before ArgoCD can sync:

```bash
# Generate a JWT secret
export JWT_SECRET=$(node -e "console.log(crypto.randomBytes(32).toString('hex'))")

# Get your RDS connection string
export DATABASE_URL="postgresql://c1pay:<password>@<cluster-endpoint>:5432/c1pay"

kubectl create namespace c1pay --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic c1pay-secrets \
  --namespace=c1pay \
  --from-literal=NODE_ENV=production \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Alternatively, use ArgoCD's **App of Apps** pattern or a secret manager (AWS Secrets Manager, Vault) with an external secrets operator.

## Deploying to the cluster

### CI/CD (recommended — GitHub Actions)

Push to `main`:
```bash
git push origin main
```

GitHub Actions:
1. Runs lint → tests → build validation
2. Builds Docker image (`argocd/Dockerfile`)
3. Pushes to ECR with `<sha>` tag
4. Updates `argocd/base/app-deployment.yaml` with the new image reference
5. ArgoCD auto-syncs (ImageUpdater annotation)

### Manual deployment

```bash
# Build and push manually
IMAGE_TAG=$(git rev-parse --short HEAD)
aws ecr get-login-password --region us-east-1 | docker login \
  --username AWS --password-stdin <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com

docker build -t c1pay:$IMAGE_TAG -f argocd/Dockerfile .
docker push <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/c1pay:$IMAGE_TAG

# Update manifest
sed -i "s|image: c1pay.*|image: <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/c1pay:$IMAGE_TAG|" \
  argocd/base/app-deployment.yaml

# Apply
kubectl apply -f argocd/base/

# Sync ArgoCD (if not using auto-sync)
argocd app sync c1pay
```

## Helm deployments (alternative to raw K8s manifests)

```bash
# Production
helm upgrade --install c1pay helm/c1pay \
  --namespace=c1pay --create-namespace \
  -f helm/c1pay/values.yaml \
  -f helm/c1pay/values-production.yaml

# Staging (pre-prod gate)
helm upgrade --install c1pay-staging helm/c1pay \
  --namespace=c1pay-staging --create-namespace \
  -f helm/c1pay/values.yaml \
  -f helm/c1pay/values-staging.yaml

# Canary (5% traffic → monitor → promote)
helm upgrade --install c1pay-canary helm/c1pay \
  --namespace=c1pay --create-namespace \
  -f helm/c1pay/values.yaml \
  -f helm/c1pay/values-canary.yaml
```

## Rollback

```bash
# ArgoCD: sync to previous committed revision
argocd app sync c1pay --revision <previous-sha>

# Or roll back K8s deployment
kubectl rollout undo deployment/c1pay -n c1pay

# Helm rollback
helm rollback c1pay <release-number> -n c1pay
```

## TLS / Certificates

cert-manager auto-provisions Let's Encrypt certificates. For production, use the `staging` issuer for testing first:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: ops@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
      - http01:
          ingress:
            class: traefik
```

## Monitoring & Health

- **Liveness probe**: `GET /health` every 15s (after 20s initial delay)
- **Readiness probe**: `GET /health` every 5s (after 10s initial delay)
- **Pod resource limits**: 500m CPU / 512Mi memory per pod

Verify:
```bash
kubectl get pods -n c1pay -w          # watch restarts
kubectl describe pod -n c1pay <pod>    # probe status
kubectl logs -n c1pay -f <pod>         # live logs
```

## Cleaning up

```bash
infrastructure/delete-eks.sh c1pay-prod us-east-1
```

This removes the EKS cluster, Traefik ingress, and all associated resources. **Data in RDS is preserved** (manual backup recommended).
