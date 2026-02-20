import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = await login(pin);
    if (success) {
      setPin('');
      setError('');
      onSuccess();
      onClose();
      // Use setTimeout to ensure modal closes before navigation
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } else {
      setError('รหัส PIN ไม่ถูกต้อง');
      setPin('');
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  // Cleanup effect to ensure no modal artifacts remain
  useEffect(() => {
    if (!isOpen) {
      // Remove any modal-related classes from body
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      // Remove any potential overlay elements
      const overlays = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      overlays.forEach(overlay => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
    }
  }, [isOpen]);

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
          <DialogTitle>Admin Login</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">รหัส PIN 6 หลัก</Label>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center space-x-3 w-fit mx-auto">
                <InputOTP
                  id="pin"
                  maxLength={6}
                  value={pin}
                  onChange={(val: string) => setPin(val)}
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
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pin.length !== 6}>เข้าสู่ระบบ</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};