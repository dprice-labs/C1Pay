{{/*
Expand the name of the chart.
*/}}
{{- define "c1pay.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "c1pay.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by a label.
*/}}
{{- define "c1pay.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "c1pay.labels" -}}
helm.sh/chart: {{ include "c1pay.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "c1pay.selectorLabels" . }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "c1pay.selectorLabels" -}}
app.kubernetes.io/name: {{ include "c1pay.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
