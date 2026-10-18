import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { DailyRotationSettings, DailyRotationUpdate } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function DailyRotationPanel({ settings, onSave, saving }: {
  settings: DailyRotationSettings; onSave: (updates: DailyRotationUpdate) => Promise<void>; saving: boolean;
}) {
  const [order, setOrder] = useState(settings.employeeOrder);
  const [currentLeader, setCurrentLeader] = useState(settings.currentLeaderEmployeeId?.toString() ?? '');
  const [notificationTime, setNotificationTime] = useState(settings.notificationTime);
  const [notificationEnabled, setNotificationEnabled] = useState(settings.notificationEnabled);
  const [dragged, setDragged] = useState<number | null>(null);
  useEffect(() => { setCurrentLeader(settings.currentLeaderEmployeeId?.toString() ?? ''); }, [settings.currentLeaderEmployeeId, settings.currentWeekStart]);
  useEffect(() => { setOrder(settings.employeeOrder); }, [settings.employeeOrder]);
  useEffect(() => { setNotificationTime(settings.notificationTime); setNotificationEnabled(settings.notificationEnabled); }, [settings.notificationTime, settings.notificationEnabled]);
  const selectedEmployee = settings.employees.find(e => e.id === Number(currentLeader));
  const selectedName = selectedEmployee?.name ?? settings.preview.find(a => a.employeeId === Number(currentLeader))?.employeeName;
  const move = (from: number, to: number) => {
    if (saving || from < 0 || to < 0 || to >= order.length) return;
    setOrder(current => { const next = [...current]; const [member] = next.splice(from, 1); next.splice(to, 0, member); return next; });
  };
  return <div className="space-y-4">
    <Card role="region" aria-labelledby="current-leader-heading" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
      <CardHeader><CardTitle id="current-leader-heading">ผู้นำสัปดาห์นี้</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-300">สัปดาห์เริ่มวันที่ {settings.currentWeekStart}</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="current-leader">เลือกผู้นำสัปดาห์นี้</Label>
          <Select value={currentLeader} onValueChange={setCurrentLeader} disabled={saving || settings.employees.length === 0}>
            <SelectTrigger id="current-leader" aria-describedby="current-leader-help"><SelectValue placeholder="เลือกผู้นำ">{selectedName}</SelectValue></SelectTrigger>
            <SelectContent>{settings.employeeOrder.map(id => {
              const employee = settings.employees.find(e => e.id === id);
              return employee && <SelectItem key={id} value={id.toString()}>{employee.name}</SelectItem>;
            })}</SelectContent>
          </Select>
        </div>
        <p id="current-leader-help" className="text-sm text-gray-500 dark:text-gray-300">เลือกให้ตรงกับคนที่นำจริงในสัปดาห์นี้ คิวสัปดาห์ถัดไปจะต่อจากคนที่เลือก หากหยุดครบสัปดาห์จะเก็บคิวไว้ใช้สัปดาห์ที่มีวันทำงาน</p>
        <p className="text-sm text-gray-500 dark:text-gray-300">สัปดาห์ที่ผ่านมาไม่เปลี่ยน และหากแจ้งเตือนไปแล้วจะไม่ส่งซ้ำ</p>
        <div className="flex justify-end"><Button disabled={saving || !selectedEmployee} onClick={() => void onSave({ currentLeaderEmployeeId: Number(currentLeader) })}>บันทึกผู้นำสัปดาห์นี้</Button></div>
      </CardContent>
    </Card>
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 space-y-0">
        <CardTitle>Daily Rotation</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 self-center"><Switch id="leader-notification-global" checked={notificationEnabled} disabled={saving} onCheckedChange={setNotificationEnabled} />
            <Label htmlFor="leader-notification-global">เปิดการแจ้งเตือนผู้นำ</Label></div>
          <div className="space-y-2"><Label htmlFor="leader-notification-time">เวลาแจ้งเตือนผู้นำ daily meeting</Label>
            <Input id="leader-notification-time" type="time" value={notificationTime} disabled={saving} className="w-32" onChange={e => setNotificationTime(e.target.value)} /></div>
          <Button disabled={saving || !notificationTime} onClick={() => void onSave({ notificationEnabled, notificationTime })}>บันทึกการแจ้งเตือนผู้นำ</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-300">แจ้งครั้งเดียวในวันทำงานแรกของสัปดาห์ ใช้เวลาเดียวกันกับทุก webhook ที่เปิดรับในแท็บ Notifications</p>
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
        <section aria-label="ผู้นำรายสัปดาห์" className="border-t border-gray-200 dark:border-gray-600 pt-4">
          <p className="font-medium mb-2">ผู้นำรายสัปดาห์</p>
          <ul className="space-y-2 text-sm">{settings.preview.slice(0, 4).map(a => <li key={a.weekStart} className="flex justify-between gap-3"><span>{a.weekStart} • event วันที่ {a.date}</span><span>{a.employeeName}</span></li>)}</ul>
        </section>
      </CardContent>
    </Card>
  </div>;
}
