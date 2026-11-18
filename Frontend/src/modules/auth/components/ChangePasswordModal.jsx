import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/form/Input';
import { useChangePasswordMutation } from '../services/authApi';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(6, 'At least 6 characters').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ChangePasswordModal({ open, onClose }) {
  const [change, { isLoading }] = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await change({ currentPassword, newPassword }).unwrap();
      toast.success('Password changed. Other devices have been signed out.');
      close();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      size="sm"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={isLoading} onClick={handleSubmit(onSubmit)}>
            Update
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Current password" type="password" {...register('currentPassword')} error={errors.currentPassword?.message} />
        <Input label="New password" type="password" {...register('newPassword')} error={errors.newPassword?.message} />
        <Input label="Confirm new password" type="password" {...register('confirm')} error={errors.confirm?.message} />
      </form>
    </Modal>
  );
}
