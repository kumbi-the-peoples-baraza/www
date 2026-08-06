apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: kumbi-tls-cert
  namespace: kumbi-staging
spec:
  secretName: kumbi-tls-cert
  duration: 2160h   # 90 days
  renewBefore: 360h # 15 days
  issuerRef:
    name: letsencrypt-staging
    kind: ClusterIssuer
  commonName: staging.kumbike.org
  dnsNames:
    - staging.kumbike.org
    - www.staging.kumbike.org
    - api.staging.kumbike.org
    - trace.staging.kumbike.org
    - vote.staging.kumbike.org
    - oops.staging.kumbike.org
    - dev.staging.kumbike.org
