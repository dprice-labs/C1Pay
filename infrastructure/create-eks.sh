#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# create-eks.sh — Provision an EKS cluster for C1Pay
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CLUSTER_NAME="${1:?Usage: $0 <cluster-name> [region]}"
REGION="${2:-us-east-1}"

echo "Creating EKS cluster '${CLUSTER_NAME}' in ${REGION} ..."

eksctl create cluster \
  --name "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --version 1.30 \
  --nodegroup-name standard \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --managed \
  --ssh-access \
  --with-oidc \

  --tags "app=c1pay,env=production"

echo "Cluster created. Run:"
echo "  aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${REGION}"
echo "  kubectl get nodes"
