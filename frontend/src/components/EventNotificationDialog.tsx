import { useEffect, useRef, useState } from 'react';
import type { Event } from '@/services/apiDatabase';
import { notifyEventNow } from '@/services/api';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from './ui/alert-dialog';

export function EventNotificationDialog({ event, onClose }: { event: Event | null; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => { setMessage(null); setSending(false); inFlight.current = false; }, [event?.id]);
  const send = async () => {
    if (!event || inFlight.current) return;
    inFlight.current = true; setSending(true);
    try {
      const response = await notifyEventNow(event.id);
      if (!response.success || !response.data) throw new Error('Unable to confirm delivery');
      const { sent, failed, alreadyClaimed, total } = response.data;
      setMessage(total === 0 ? 'ยังไม่มี webhook ที่เปิดแจ้งเหตุการณ์ บันทึกเหตุการณ์แล้วแต่ยังไม่ได้ส่งแจ้งเตือน' :
        `ส่งสำเร็จ ${sent} ปลายทาง${failed ? ` • ส่งไม่สำเร็จ ${failed} ปลายทาง` : ''}${alreadyClaimed ? ` • เคยส่งหรือเริ่มส่งแล้ว ${alreadyClaimed} ปลายทาง จึงไม่ส่งซ้ำ` : ''}`);
    } catch {
      setMessage('บันทึกเหตุการณ์แล้ว แต่ไม่สามารถยืนยันการส่งแจ้งเตือนได้ กรุณาตรวจสอบใน MS Teams ก่อนส่งอีกครั้ง');
    } finally { setSending(false); }
  };
  return <AlertDialog open={!!event} onOpenChange={open => { if (!open && !sending) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>ส่งแจ้งเตือนเข้า MS Teams เลยไหม?</AlertDialogTitle>
        <AlertDialogDescription>บันทึกเหตุการณ์ของ {event?.employeeName} เรียบร้อยแล้ว เหตุการณ์นี้ตรงกับวันนี้ ต้องการแจ้งทีมตอนนี้ไหม?</AlertDialogDescription>
      </AlertDialogHeader>
      <p className="text-sm text-muted-foreground">ส่งไปยัง webhook ที่เปิด “แจ้งเหตุการณ์” โดยไม่รอเวลาที่ตั้งไว้</p>
      {message && <p role="status" className="text-sm">{message}</p>}
      <AlertDialogFooter>
        <Button variant="outline" disabled={sending} onClick={onClose}>{message ? 'ปิด' : 'ไม่ส่งตอนนี้'}</Button>
        {!message && <Button disabled={sending} onClick={() => void send()}>{sending ? 'กำลังส่ง…' : 'ส่งแจ้งเตือน'}</Button>}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
