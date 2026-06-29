#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# delete-eks.sh — Tear down an EKS cluster and ALB (DANGER: destructive)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CLUSTER_NAME="${1:?Usage: $0 <cluster-name> [region]}"
REGION="${2:-us-east-1}"

echo "WARNING: This will DELETE cluster '${CLUSTER_NAME}' and all resources."
read -rp "Type '${CLUSTER_NAME}' to confirm: " confirm
[[ "${confirm}" == "${CLUSTER_NAME}" ]] || { echo "Aborted."; exit 1; }

# Remove ingress before the cluster (ALB must exist before nodes/cluster)
kubectl delete svc aws-load-balancer-controller -n kube-system --ignore-not-found || true
kubectl delete deployment/aws-load-balancer-controller -n kube-system --ignore-not-found || true

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
