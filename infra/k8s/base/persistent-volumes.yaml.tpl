---
# PersistentVolumes — paths substituted at deploy time via envsubst
# from POSTGRES_DATA_DIR / STORAGE_DATA_DIR / CERT_DATA_DIR in secrets.yaml.
# PVCs live in the base manifests (backend.yaml / postgres.yaml); these PVs
# are the hostPath backing stores. Certificates persist under CERT_DATA_DIR
# and are managed only by `make tls` (never overwritten by `make deploy`).
apiVersion: v1
kind: PersistentVolume
metadata:
  name: kumbi-postgres-pv
  labels:
    app: postgres
spec:
  capacity:
    storage: 2Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: kumbi-postgres
  hostPath:
    path: ${POSTGRES_DATA_DIR}
    type: DirectoryOrCreate
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: Exists
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: kumbi-storage-pv
  labels:
    app: backend
spec:
  capacity:
    storage: 5Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: kumbi-storage
  hostPath:
    path: ${STORAGE_DATA_DIR}
    type: DirectoryOrCreate
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: Exists
