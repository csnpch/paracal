import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiDatabase } from '../services/apiDatabase';

interface AdminChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminChangePinModal: React.FC<AdminChangePinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPin !== confirmPin) {
      setError('รหัส PIN ใหม่ไม่ตรงกัน');
      return;
    }

    if (newPin.length !== 6 || oldPin.length !== 6) {
      setError('รหัส PIN ต้องมี 6 หลัก');
      return;
    }

    setLoading(true);
    const apiDb = getApiDatabase();
    const result = await apiDb.changeAdminPin(oldPin, newPin);

    if (result.success) {
      setSuccessMsg('เปลี่ยนรหัส PIN สำเร็จ');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } else {
      setError(result.message || 'รหัส PIN เดิมไม่ถูกต้อง หรือเกิดข้อผิดพลาด');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccessMsg('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      const overlays = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      overlays.forEach(overlay => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
    }
  }, [isOpen]);

  const handlePinChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setter(val);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      modal={true}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เปลี่ยนรหัส PIN</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPin">รหัส PIN เดิม</Label>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center space-x-3 w-fit mx-auto">
                <InputOTP
                  id="oldPin"
                  maxLength={6}
                  value={oldPin}
                  onChange={(val) => setOldPin(val)}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPin">รหัส PIN ใหม่</Label>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center space-x-3 w-fit mx-auto">
                <InputOTP
                  id="newPin"
                  maxLength={6}
                  value={newPin}
                  onChange={(val) => setNewPin(val)}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">ยืนยันรหัส PIN ใหม่</Label>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center space-x-3 w-fit mx-auto">
                <InputOTP
                  id="confirmPin"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(val) => setConfirmPin(val)}
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
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMsg && (
            <Alert className="bg-green-50 text-green-700 border-green-200">
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={oldPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6 || loading}>
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
