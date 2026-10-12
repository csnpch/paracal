import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { DailyRotationSettings, DailyRotationUpdate } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function DailyRotationPanel({ settings, onSave, saving }: {
  settings: DailyRotationSettings; onSave: (updates: DailyRotationUpdate) => Promise<void>; saving: boolean;
}) {
  const [order, setOrder] = useState(settings.employeeOrder);
  const [nextLeader, setNextLeader] = useState(settings.nextLeaderEmployeeId?.toString() ?? '');
  useEffect(() => { setNextLeader(settings.nextLeaderEmployeeId?.toString() ?? ''); }, [settings.nextLeaderEmployeeId, settings.nextWeekStart]);
  const [dragged, setDragged] = useState<number | null>(null);
  useEffect(() => { setOrder(settings.employeeOrder); }, [settings.employeeOrder]);
  const move = (from: number, to: number) => {
    if (saving || from < 0 || to < 0 || to >= order.length) return;
    setOrder(current => { const next = [...current]; const [member] = next.splice(from, 1); next.splice(to, 0, member); return next; });
  };
  return <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
    <CardHeader className="flex flex-row items-center justify-between gap-4">
      <CardTitle>Daily Rotation</CardTitle>
      <div className="flex items-center gap-3"><Label htmlFor="rotation-enabled">เปิดใช้งาน Daily Rotation</Label>
        <Switch id="rotation-enabled" checked={settings.enabled} disabled={saving} onCheckedChange={enabled => void onSave({ enabled })} /></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-300">ลำดับเริ่มต้นตามวันที่เพิ่มผู้ใช้ ผู้ใช้ใหม่ต่อท้ายอัตโนมัติ</p>
      {order.length === 0 && <p>ยังไม่มีผู้ใช้ในระบบ</p>}
      <ol className="space-y-2">
        {order.map((id, index) => {
          const name = settings.employees.find(e => e.id === id)?.name ?? `${id}`;
          return <li key={id} draggable={!saving} onDragStart={() => setDragged(id)} onDragEnd={() => setDragged(null)}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged !== null) move(order.indexOf(dragged), index); setDragged(null); }}
            className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" /><span className="text-gray-400 w-5">{index + 1}</span>
            <span className="flex-1 min-w-0 break-words">{name}</span>
            <Button size="sm" variant="outline" aria-label={`เลื่อน ${name} ขึ้น`} disabled={saving || index === 0} onClick={() => move(index, index - 1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" aria-label={`เลื่อน ${name} ลง`} disabled={saving || index === order.length - 1} onClick={() => move(index, index + 1)}><ArrowDown className="h-4 w-4" /></Button>
          </li>;
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500 dark:text-gray-300">หยุดครบสัปดาห์จะไม่ใช้คิว • การจัดลำดับใหม่มีผลสัปดาห์ถัดไป</p>
        <Button disabled={saving || JSON.stringify(order) === JSON.stringify(settings.employeeOrder)} onClick={() => void onSave({ employeeOrder: order })}>บันทึกลำดับ</Button></div>
      <section aria-labelledby="next-leader-heading" className="border-t border-gray-200 dark:border-gray-600 pt-5 space-y-3">
        <div><h3 id="next-leader-heading" className="font-medium">ผู้นำสัปดาห์หน้า</h3>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">สัปดาห์เริ่มวันที่ {settings.nextWeekStart}</p></div>
        <div className="space-y-2">
          <Label htmlFor="next-leader">เลือกผู้นำสัปดาห์หน้า</Label>
          <Select value={nextLeader} onValueChange={setNextLeader} disabled={saving || settings.employees.length === 0}>
            <SelectTrigger id="next-leader" aria-describedby="next-leader-help"><SelectValue placeholder="เลือกผู้นำ" /></SelectTrigger>
            <SelectContent>{settings.employeeOrder.map(id => {
              const employee = settings.employees.find(e => e.id === id);
              return employee && <SelectItem key={id} value={id.toString()}>{employee.name}</SelectItem>;
            })}</SelectContent>
          </Select>
        </div>
        <p id="next-leader-help" className="text-sm text-gray-500 dark:text-gray-300">หมุนคิวต่อจากคนที่เลือกตามลำดับที่บันทึกไว้ หากหยุดครบสัปดาห์จะเลื่อนไปสัปดาห์ที่มีวันทำงาน</p>
        {!settings.enabled && <p className="text-sm text-gray-500 dark:text-gray-300">เลือกไว้ก่อนเปิดใช้งานได้ สัปดาห์ที่ผ่านมาและสัปดาห์ปัจจุบันจะไม่เปลี่ยน</p>}
        <div className="flex justify-end"><Button disabled={saving || !nextLeader || settings.employees.length === 0}
          onClick={() => void onSave({ nextLeaderEmployeeId: Number(nextLeader) })}>บันทึกผู้นำสัปดาห์หน้า</Button></div>
      </section>
      <section aria-label="ผู้นำรายสัปดาห์" className="border-t border-gray-200 dark:border-gray-600 pt-4">
        <p className="font-medium mb-2">ผู้นำรายสัปดาห์</p>
        {!settings.enabled && <p className="text-sm text-gray-500 mb-2">ฟีเจอร์ปิดอยู่ — ตัวอย่างคิวจะแสดงใน calendar เมื่อเปิดใช้งาน</p>}
        <ul className="space-y-2 text-sm">{settings.preview.slice(0, 4).map(a => <li key={a.weekStart} className="flex justify-between gap-3"><span>{a.weekStart} • event วันที่ {a.date}</span><span>{a.employeeName}</span></li>)}</ul>
      </section>
    </CardContent>
  </Card>;
}
