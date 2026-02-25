import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getLogs,
  clearAllLogs,
  deleteOldLogs,
  type ActivityLog,
  type LogAction,
  type LogEntity,
} from '@/services/logService';
import {
  Trash2,
  RefreshCw,
  Filter,
  Clock,
  Plus,
  Edit2,
  X,
  ShieldCheck,
  KeyRound,
  LogIn,
  Calendar,
  Users,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import moment from 'moment';
import 'moment/locale/th';

moment.locale('th');

// ── Helpers ──────────────────────────────────────────────────

const ACTION_CONFIG: Record<LogAction, { label: string; color: string; Icon: React.ElementType }> = {
  CREATE: { label: 'สร้างใหม่', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: Plus },
  UPDATE: { label: 'แก้ไข', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', Icon: Edit2 },
  DELETE: { label: 'ลบ', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', Icon: X },
  CLEAR: { label: 'ล้างข้อมูล', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', Icon: Trash2 },
  LOGIN: { label: 'เข้าสู่ระบบ', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', Icon: LogIn },
  CHANGE_PIN: { label: 'เปลี่ยน PIN', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', Icon: KeyRound },
};

const ENTITY_CONFIG: Record<LogEntity, { label: string; Icon: React.ElementType; color: string }> = {
  event: { label: 'Event', Icon: Calendar, color: 'text-blue-500' },
  employee: { label: 'พนักงาน', Icon: Users, color: 'text-indigo-500' },
  company_holiday: { label: 'วันหยุดบริษัท', Icon: Calendar, color: 'text-rose-500' },
  cronjob: { label: 'Cronjob', Icon: Settings, color: 'text-amber-500' },
  admin: { label: 'Admin', Icon: ShieldCheck, color: 'text-purple-500' },
};

const ALL_ACTIONS: (LogAction | 'ALL')[] = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'CLEAR', 'LOGIN', 'CHANGE_PIN'];
const ALL_ENTITIES: (LogEntity | 'ALL')[] = ['ALL', 'event', 'employee', 'company_holiday', 'cronjob', 'admin'];

// ── PIN Dialog ────────────────────────────────────────────────

interface PinDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const PinDialog: React.FC<PinDialogProps> = ({ open, title, description, onConfirm, onCancel, loading }) => {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      onConfirm(pin);
      setPin('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(''); onCancel(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 py-4">
            <Label>รหัส PIN 6 หลัก</Label>
            <div className="flex items-center justify-center">
              <InputOTP
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPin(''); onCancel(); }}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={pin.length !== 6 || loading}>
              {loading ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Log Row ──────────────────────────────────────────────────

const LogRow: React.FC<{ log: ActivityLog; index: number }> = ({ log, index }) => {
  const action = ACTION_CONFIG[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-700', Icon: RefreshCw };
  const entity = ENTITY_CONFIG[log.entity as LogEntity] ?? { label: log.entity, Icon: Settings, color: 'text-gray-500' };
  const ActionIcon = action.Icon;
  const EntityIcon = entity.Icon;

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50
        hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors
        ${index === 0 ? 'rounded-t-lg' : ''}
      `}
    >
      {/* Action badge */}
      <div className="flex-shrink-0 pt-0.5">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${action.color}`}>
          <ActionIcon className="w-3 h-3" />
          {action.label}
        </span>
      </div>

      {/* Entity + detail */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <EntityIcon className={`w-3.5 h-3.5 flex-shrink-0 ${entity.color}`} />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entity.label}</span>
          {log.entityName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              — {log.entityName}
            </span>
          )}
        </div>
        {log.detail && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{log.detail}</p>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Clock className="w-3 h-3" />
          <span title={moment(log.createdAt).format('DD/MM/YYYY HH:mm:ss')}>
            {moment(log.createdAt).fromNow()}
          </span>
        </div>
        <div className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
          {moment(log.createdAt).format('DD/MM/YY HH:mm')}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────

type DialogType = 'clearAll' | 'deleteOld' | null;

const AdminLogsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterAction, setFilterAction] = useState<LogAction | 'ALL'>('ALL');
  const [filterEntity, setFilterEntity] = useState<LogEntity | 'ALL'>('ALL');
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  const queryKey = ['activity-logs', filterAction, filterEntity];

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => getLogs({
      action: filterAction !== 'ALL' ? filterAction : undefined,
      entity: filterEntity !== 'ALL' ? filterEntity : undefined,
      limit: 200,
    }),
    refetchOnWindowFocus: false,
  });

  const clearMutation = useMutation({
    mutationFn: (pin: string) => clearAllLogs(pin),
    onSuccess: (result) => {
      toast({ title: '✅ ล้าง Logs สำเร็จ', description: `ลบไปทั้งหมด ${result.deletedCount} รายการ` });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setActiveDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: '❌ เกิดข้อผิดพลาด', description: err.message || 'PIN ไม่ถูกต้อง', variant: 'destructive' });
    },
  });

  const deleteOldMutation = useMutation({
    mutationFn: (pin: string) => deleteOldLogs(pin, 10),
    onSuccess: (result) => {
      toast({ title: '✅ ลบ Logs เก่าสำเร็จ', description: `ลบ logs เก่ากว่า 10 วัน ได้ ${result.deletedCount} รายการ` });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setActiveDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: '❌ เกิดข้อผิดพลาด', description: err.message || 'PIN ไม่ถูกต้อง', variant: 'destructive' });
    },
  });

  const handlePinConfirm = useCallback((pin: string) => {
    if (activeDialog === 'clearAll') clearMutation.mutate(pin);
    else if (activeDialog === 'deleteOld') deleteOldMutation.mutate(pin);
  }, [activeDialog, clearMutation, deleteOldMutation]);

  const isActionLoading = clearMutation.isPending || deleteOldMutation.isPending;

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-purple-500" />
              Activity Logs
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              บันทึกการกระทำทั้งหมดในระบบ
              {total > 0 && <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">({total} รายการ)</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('deleteOld')}
              className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/30"
            >
              <Clock className="w-4 h-4" />
              ลบ logs {'>'} 10 วัน
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('clearAll')}
              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              ล้างทั้งหมด
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ตัวกรอง</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Action</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ACTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setFilterAction(a as LogAction | 'ALL')}
                    className={`
                      text-xs px-2.5 py-1 rounded-full border transition-all
                      ${filterAction === a
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent font-medium'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-400'
                      }
                    `}
                  >
                    {a === 'ALL' ? 'ทั้งหมด' : (ACTION_CONFIG[a as LogAction]?.label ?? a)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Entity</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ENTITIES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setFilterEntity(e as LogEntity | 'ALL')}
                    className={`
                      text-xs px-2.5 py-1 rounded-full border transition-all
                      ${filterEntity === e
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent font-medium'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-400'
                      }
                    `}
                  >
                    {e === 'ALL' ? 'ทั้งหมด' : (ENTITY_CONFIG[e as LogEntity]?.label ?? e)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Log list */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              กำลังโหลด...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-48 text-red-400">
              เกิดข้อผิดพลาด ไม่สามารถโหลด logs ได้
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500 gap-2">
              <ShieldCheck className="w-10 h-10 opacity-30" />
              <p className="text-sm">ไม่มี logs ในขณะนี้</p>
            </div>
          ) : (
            <div>
              {logs.map((log, i) => (
                <LogRow key={log.id} log={log} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Info footer */}
        {logs.length > 0 && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
            แสดง {logs.length} จาก {total} รายการ (สูงสุด 200 ต่อครั้ง) • Logs เก่ากว่า 10 วันจะถูกลบอัตโนมัติทุกคืน 02:00 น.
          </p>
        )}
      </div>

      {/* PIN Dialogs */}
      <PinDialog
        open={activeDialog === 'clearAll'}
        title="ล้าง Logs ทั้งหมด"
        description="การดำเนินการนี้จะลบ activity logs ทั้งหมดออกจากระบบ ไม่สามารถกู้คืนได้ กรุณายืนยันด้วย Admin PIN"
        onConfirm={handlePinConfirm}
        onCancel={() => setActiveDialog(null)}
        loading={isActionLoading}
      />
      <PinDialog
        open={activeDialog === 'deleteOld'}
        title="ลบ Logs เก่ากว่า 10 วัน"
        description="การดำเนินการนี้จะลบ activity logs ที่เก่ากว่า 10 วัน กรุณายืนยันด้วย Admin PIN"
        onConfirm={handlePinConfirm}
        onCancel={() => setActiveDialog(null)}
        loading={isActionLoading}
      />
    </Layout>
  );
};

export default AdminLogsPage;
