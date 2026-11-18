import Button from './Button';
import Modal from './Modal';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmText = 'Delete',
  onConfirm,
  onClose,
  loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}
