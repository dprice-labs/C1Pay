#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# delete-eks.sh — Tear down an EKS cluster and Traefik ingress (DANGER: destructive)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CLUSTER_NAME="${1:?Usage: $0 <cluster-name> [region]}"
REGION="${2:-us-east-1}"

echo "WARNING: This will DELETE cluster '${CLUSTER_NAME}' and all resources."
read -rp "Type '${CLUSTER_NAME}' to confirm: " confirm
[[ "${confirm}" == "${CLUSTER_NAME}" ]] || { echo "Aborted."; exit 1; }

# Remove Traefik ingress before the cluster (ingress controllers block cluster teardown)
helm uninstall traefik -n traefik --no-history 2>/dev/null || true
kubectl delete namespace traefik --ignore-not-found || true

# Detach VPC CNI addon (must be detached before removing the cluster addon)
eksctl delete addon \
  --cluster "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --name vpc-cni \
  --force-discover \
  --preserve-nodepool || true

# Delete the cluster
eksctl delete cluster \
  --name "${CLUSTER_NAME}" \
  --region "${REGION}"

echo "Cluster '${CLUSTER_NAME}' deleted."
