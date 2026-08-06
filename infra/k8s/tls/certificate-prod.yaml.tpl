apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: kumbi-tls-cert
  namespace: kumbi-prod
spec:
  secretName: kumbi-tls-cert
  duration: 2160h   # 90 days
  renewBefore: 360h # 15 days
  issuerRef:
    name: letsencrypt-${TLS_FLAVOR}
    kind: ClusterIssuer
  commonName: kumbike.org
  dnsNames:
    - kumbike.org
    - www.kumbike.org
    - trace.kumbike.org
    - vote.kumbike.org
    - oops.kumbike.org
    - dev.kumbike.org
