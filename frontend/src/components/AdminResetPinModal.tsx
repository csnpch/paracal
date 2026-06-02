import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiDatabase } from '../services/apiDatabase';

interface AdminResetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminResetPinModal: React.FC<AdminResetPinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (pin.length !== 6) {
      setError('รหัส PIN ต้องมี 6 หลัก');
      return;
    }

    setLoading(true);
    const apiDb = getApiDatabase();
    const result = await apiDb.resetAdminPin(pin);

    if (result.success) {
      const defaultPin = result.defaultPin || '000000';
      setSuccessMsg(`คืนค่ารหัส PIN เป็น ${defaultPin} เรียบร้อยแล้ว`);
      setPin('');
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } else {
      setError(result.message === 'Invalid PIN' ? 'รหัส PIN ไม่ถูกต้อง' : (result.message || 'เกิดข้อผิดพลาด'));
      setPin('');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setPin('');
    setError('');
    setSuccessMsg('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      modal={true}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>คืนค่ารหัส PIN</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            รหัส PIN จะถูกรีเซ็ตเป็น <span className="font-semibold">000000</span> กรุณายืนยันด้วยรหัส PIN ปัจจุบัน
          </p>

          <div className="space-y-2">
            <Label htmlFor="resetPin">รหัส PIN ปัจจุบัน</Label>
            <div className="flex flex-col items-center justify-center">
              <InputOTP
                id="resetPin"
                maxLength={6}
                value={pin}
                onChange={(val) => setPin(val)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} hideChar={true} />
                  <InputOTPSlot index={1} hideChar={true} />
                  <InputOTPSlot index={2} hideChar={true} />
                  <InputOTPSlot index={3} hideChar={true} />
                  <InputOTPSlot index={4} hideChar={true} />
                  <InputOTPSlot index={5} hideChar={true} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMsg && (
            <Alert className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pin.length !== 6 || loading}
            >
              คืนค่า PIN
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
