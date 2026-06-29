#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# create-alb.sh — Attach ALB Ingress Controller to the EKS cluster
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CLUSTER_NAME="${1:?Usage: $0 <cluster-name> [region]}"
REGION="${2:-us-east-1}"

echo "Ensuring ALB Ingress Controller is installed on '${CLUSTER_NAME}' ..."

# Install via eksctl addon (iam-policies include eck-alb-ingress)
eksctl create iampolicy \
  --name AmazonEKSALBIngressControllerPolicy \
  --cluster "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --compose-from-sa ALBIngressControllerIAMPolicy \
  --output-file /tmp/alb-policy.json

eksctl create clusteraddon \
  --cluster "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --name vpc-cni \
  --force

kubectl apply -k "github.com/kubernetes-sigs/aws-load-balancer-controller/charts/base?ref=master"
kubectl apply -k "github.com/kubernetes-sigs/aws-load-balancer-controller/charts/awsLoadBalancerController?ref=main,test"

echo "ALB Ingress Controller installed."
echo "Verify: kubectl get pods -n kube-system | grep aws-load-balancer"
