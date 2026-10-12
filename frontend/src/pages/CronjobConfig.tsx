import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from '../hooks/use-toast';
import { useTheme } from '../contexts/ThemeContext';
import { Layout } from '../components/Layout';
import { DailyRotationPanel } from '../components/DailyRotationPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  getCronjobConfigs,
  getCronjobStatus,
  createCronjobConfig,
  updateCronjobConfig,
  deleteCronjobConfig,
  testCronjobNotification,
  getDailyRotationSettings,
  updateDailyRotationSettings,
  type DailyRotationSettings,
  type DailyRotationUpdate,
  type CronjobConfig,
  type CronjobStatus
} from '../services/api';
import {
  Trash2,
  Edit,
  Play,
  Plus,
  RotateCcw,
  Loader2, Bell, Users, Calendar, Mic, Megaphone, Copy
} from 'lucide-react';

export default function CronjobConfig() {
  const { theme } = useTheme();
  const [configs, setConfigs] = useState<CronjobConfig[]>([]);
  const [statuses, setStatuses] = useState<CronjobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CronjobConfig | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testingConfigId, setTestingConfigId] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [rotation, setRotation] = useState<DailyRotationSettings | null>(null);
  const [savingRotation, setSavingRotation] = useState(false);
  const [savingConfig, setSavingConfig] = useState<number | null>(null);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  useEffect(() => {
    if (rotation) { setNotificationTime(rotation.notificationTime); setNotificationEnabled(rotation.notificationEnabled); }
  }, [rotation]);
  const saveRotation = async (updates: DailyRotationUpdate) => {
    setSavingRotation(true);
    try {
      const response = await updateDailyRotationSettings(updates);
      if (!response.success || !response.data) throw new Error(response.error || 'บันทึกไม่สำเร็จ');
      setRotation(response.data);
      toast({ title: 'บันทึกแล้ว', variant: 'success' });
    } catch (error) { toast({ title: 'บันทึกไม่สำเร็จ', description: error instanceof Error ? error.message : 'กรุณาลองใหม่', variant: 'destructive' }); }
    finally { setSavingRotation(false); }
  };
  const toggleNotification = async (config: CronjobConfig, updates: { enabled?: boolean; daily_leader_enabled?: boolean }) => {
    setSavingConfig(config.id);
    try {
      const response = await updateCronjobConfig(config.id, updates);
      if (!response.success) throw new Error(response.error || 'บันทึกไม่สำเร็จ');
      setConfigs(current => current.map(c => c.id === config.id ? { ...c, ...updates } : c));
    } catch (error) { toast({ title: 'บันทึกไม่สำเร็จ', description: error instanceof Error ? error.message : 'กรุณาลองใหม่', variant: 'destructive' }); }
    finally { setSavingConfig(null); }
  };

  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    schedule_time: '09:00',
    webhook_url: '',
    notification_days: 1,
    notification_type: 'daily' as 'daily' | 'weekly',
    weekly_days: [] as number[],
    weekly_scope: 'current' as 'current' | 'next'
  });

  const loadConfigs = async () => {
    try {
      const [configResponse, statusResponse, rotationResponse] = await Promise.all([
        getCronjobConfigs(),
        getCronjobStatus(),
        getDailyRotationSettings().catch(() => ({ success: false, data: undefined, error: 'Failed to load rotation' }))
      ]);
      if (rotationResponse.success && rotationResponse.data) setRotation(rotationResponse.data);

      if (configResponse.success && configResponse.data) {
        setConfigs(configResponse.data);
      }

      if (statusResponse.success && statusResponse.data) {
        setStatuses(statusResponse.data);
      }
      if (!rotationResponse.success) throw new Error(rotationResponse.error || 'Failed to load rotation');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load cronjob configurations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const [configResponse, statusResponse, rotationResponse] = await Promise.all([
        getCronjobConfigs(),
        getCronjobStatus(),
        getDailyRotationSettings().catch(() => ({ success: false, data: undefined, error: 'Failed to load rotation' }))
      ]);
      if (rotationResponse.success && rotationResponse.data) setRotation(rotationResponse.data);

      if (configResponse.success && configResponse.data) {
        setConfigs(configResponse.data);
      }

      if (statusResponse.success && statusResponse.data) {
        setStatuses(statusResponse.data);
      }
      if (!rotationResponse.success) throw new Error(rotationResponse.error || 'Failed to load rotation');

      // Show success notification that auto-closes in 2 seconds
      toast({
        title: 'Refreshed',
        description: 'Cronjob configurations refreshed successfully',
        variant: 'success',
        duration: 2000
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh cronjob configurations',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleCreate = async () => {
    try {
      // notification_days: UI shows "Today"=0, "Tomorrow"=1 and backend uses "Today"=0, "Tomorrow"=1 (same values)
      const adjustedFormData = {
        ...formData,
        notification_days: formData.notification_days,
        weekly_days: formData.notification_type === 'weekly' ? formData.weekly_days : undefined,
        weekly_scope: formData.notification_type === 'weekly' ? formData.weekly_scope : undefined
      };
      const response = await createCronjobConfig(adjustedFormData);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Cronjob configuration created successfully',
          variant: 'success'
        });
        setIsCreateDialogOpen(false);
        resetForm();
        loadConfigs();
      } else {
        throw new Error(response.error || 'Failed to create configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create configuration',
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingConfig) return;

    try {
      // notification_days: UI shows "Today"=0, "Tomorrow"=1 and backend uses "Today"=0, "Tomorrow"=1 (same values)
      const adjustedFormData = {
        ...formData,
        notification_days: formData.notification_days,
        weekly_days: formData.notification_type === 'weekly' ? formData.weekly_days : undefined,
        weekly_scope: formData.notification_type === 'weekly' ? formData.weekly_scope : undefined
      };
      const response = await updateCronjobConfig(editingConfig.id, adjustedFormData);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Cronjob configuration updated successfully',
          variant: 'success'
        });
        setIsEditDialogOpen(false);
        setEditingConfig(null);
        resetForm();
        loadConfigs();
      } else {
        throw new Error(response.error || 'Failed to update configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update configuration',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cronjob configuration?')) return;

    try {
      const response = await deleteCronjobConfig(id);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Cronjob configuration deleted successfully',
          variant: 'success'
        });
        loadConfigs();
      } else {
        throw new Error(response.error || 'Failed to delete configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete configuration',
        variant: 'destructive'
      });
    }
  };

  const openTestDialog = (id: number) => {
    setTestingConfigId(id);
    setTestMessage('');
    setIsTestDialogOpen(true);
  };

  const handleTestSubmit = async () => {
    if (testingConfigId === null) return;
    try {
      const response = await testCronjobNotification(testingConfigId, testMessage);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Test notification sent successfully',
          variant: 'success'
        });
        setIsTestDialogOpen(false);
      } else {
        throw new Error(response.error || 'Failed to send test notification');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (config: CronjobConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      enabled: Boolean(config.enabled),
      schedule_time: config.schedule_time,
      webhook_url: config.webhook_url,
      // notification_days: backend and UI use same values ("Today"=0, "Tomorrow"=1)
      notification_days: config.notification_days,
      notification_type: config.notification_type || 'daily',
      weekly_days: config.weekly_days || [5],
      weekly_scope: config.weekly_scope || 'current'
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      enabled: true,
      schedule_time: '09:00',
      webhook_url: '',
      notification_days: 1,
      notification_type: 'daily',
      weekly_days: [5],
      weekly_scope: 'current'
    });
  };

  const weekdays = [
    { value: 1, label: 'จันทร์' },
    { value: 2, label: 'อังคาร' },
    { value: 3, label: 'พุธ' },
    { value: 4, label: 'พฤหัสบดี' },
    { value: 5, label: 'ศุกร์' },
  ];

  const handleWeekdayToggle = (dayValue: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      weekly_days: checked
        ? [...prev.weekly_days, dayValue]
        : prev.weekly_days.filter(day => day !== dayValue)
    }));
  };

  const getStatusBadge = (config: CronjobConfig) => {
    const status = statuses.find(s => s.id === config.id);

    // If no status found from backend, fall back to config.enabled
    const isEnabled = config.enabled || (config.daily_leader_enabled && rotation?.enabled && rotation?.notificationEnabled);
    const isRunning = status?.running ?? false;

    if (isEnabled && isRunning) {
      return <Badge variant="default" className="bg-green-500">Running</Badge>;
    } else if (isEnabled) {
      return <Badge variant="secondary">Scheduled</Badge>;
    } else {
      return <Badge variant="outline">Disabled</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Layout currentPage="cronjob-config">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-normal text-gray-900 dark:text-white">Cronjob Configuration</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Manage notification schedules and webhooks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Cronjob
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Create Cronjob Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Daily Notification"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schedule_time">Schedule Time <span className="text-red-500">*</span></Label>
                    <div className="relative w-full">
                      <Input
                        id="schedule_time"
                        type="time"
                        value={formData.schedule_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
                        className="w-full cursor-pointer pr-10"
                        style={{
                          colorScheme: theme === 'dark' ? 'dark' : 'light',
                          width: '100%'
                        }}
                        onClick={(e) => {
                          const input = e.currentTarget;
                          input.showPicker?.();
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="webhook_url">Webhook URL <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="webhook_url"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notification_type">Notification Type <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.notification_type}
                      onValueChange={(value: 'daily' | 'weekly') => setFormData(prev => ({ ...prev, notification_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.notification_type === 'daily' && (
                    <div>
                      <Label htmlFor="notification_days">Notification Days <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.notification_days.toString()}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, notification_days: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Today</SelectItem>
                          <SelectItem value="1">Tomorrow</SelectItem>
                          <SelectItem value="2">2 days ahead</SelectItem>
                          <SelectItem value="3">3 days ahead</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.notification_type === 'weekly' && (
                    <>
                      <div>
                        <Label>Notification Days <span className="text-red-500">*</span></Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {weekdays.map((day) => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`weekday-${day.value}`}
                                checked={formData.weekly_days.includes(day.value)}
                                onCheckedChange={(checked) => handleWeekdayToggle(day.value, !!checked)}
                              />
                              <Label htmlFor={`weekday-${day.value}`} className="text-sm">
                                {day.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="weekly_scope">Week Scope <span className="text-red-500">*</span></Label>
                        <Select
                          value={formData.weekly_scope}
                          onValueChange={(value: 'current' | 'next') => setFormData(prev => ({ ...prev, weekly_scope: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current">สัปดาห์นี้ (Current Week)</SelectItem>
                            <SelectItem value="next">สัปดาห์หน้า (Next Week)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="notifications" className="space-y-5">
          <TabsList className="bg-transparent border-b border-gray-200 dark:border-gray-600 rounded-none h-auto p-0 gap-3">
            <TabsTrigger value="rotation" className="gap-2 px-4 py-3"><Users className="h-4 w-4" />Daily Rotation</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 px-4 py-3"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="rotation">
            {rotation ? <DailyRotationPanel settings={rotation} saving={savingRotation} onSave={saveRotation} /> : <p role="alert">โหลดการตั้งค่าไม่สำเร็จ กรุณากด Refresh</p>}
          </TabsContent>
          <TabsContent value="notifications" className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">เลือกเรื่องที่แจ้งเตือนแยกกันในแต่ละ webhook</p>
            {rotation && <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
              <CardHeader><CardTitle className="text-lg">การแจ้งเตือนผู้นำ daily meeting</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2"><Switch id="leader-notification-global" checked={notificationEnabled} disabled={savingRotation} onCheckedChange={setNotificationEnabled} />
                    <Label htmlFor="leader-notification-global">เปิดการแจ้งเตือนผู้นำ</Label></div>
                  <div className="flex items-center gap-3"><Label htmlFor="leader-notification-time">เวลาแจ้งเตือนผู้นำ daily meeting</Label>
                    <Input id="leader-notification-time" type="time" value={notificationTime} disabled={savingRotation} className="w-32" onChange={e => setNotificationTime(e.target.value)} /></div>
                  <Button disabled={savingRotation || !notificationTime} onClick={() => void saveRotation({ notificationEnabled, notificationTime })}>บันทึกการแจ้งเตือนผู้นำ</Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-300">ใช้เวลาเดียวกันกับทุก webhook ที่เปิดรับ • แจ้งครั้งเดียวในวันทำงานแรกของสัปดาห์</p>
                <p className="text-sm text-gray-500 dark:text-gray-300">หากวันจันทร์หยุดจะเลื่อนไปวันทำงานแรก ถ้าหยุดครบสัปดาห์จะไม่ใช้คิว</p>
                {!rotation.enabled && <p className="text-sm text-amber-600 dark:text-amber-300">ฟีเจอร์ Daily Rotation ปิดอยู่ การแจ้งเตือนผู้นำพักไว้</p>}
              </CardContent>
            </Card>}
            <div className="grid gap-4">
              {configs.length === 0 && <Card><CardContent className="py-8 text-center">No cronjob configurations found. Create your first one!</CardContent></Card>}
              {[...configs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(config => {
                const leaderActive = rotation?.enabled && rotation?.notificationEnabled;
                const next = rotation?.preview.find(a => a.date >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
                let maskedUrl = '…';
                try { maskedUrl = new URL(config.webhook_url).origin + '/…'; } catch { /* invalid legacy URL is editable in its existing form */ }
                return <Card key={config.id} role="article" aria-label={config.name} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0"><Megaphone className="h-5 w-5 shrink-0" /><CardTitle className="text-lg break-words">{config.name}</CardTitle>{getStatusBadge(config)}</div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" aria-label={`ทดสอบ ${config.name}`} onClick={() => openTestDialog(config.id)}><Play className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" aria-label={`แก้ไข ${config.name}`} onClick={() => openEditDialog(config)}><Edit className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" aria-label={`ลบ ${config.name}`} onClick={() => handleDelete(config.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm mt-3"><span className="text-gray-500 dark:text-gray-300">Webhook URL</span><span className="flex-1 min-w-0 truncate rounded border border-gray-200 dark:border-gray-600 px-3 py-2">{maskedUrl}</span>
                      <Button size="sm" variant="ghost" aria-label={`คัดลอก webhook ${config.name}`} onClick={async () => { try { await navigator.clipboard.writeText(config.webhook_url); toast({ title: 'คัดลอก webhook แล้ว' }); } catch { toast({ title: 'คัดลอกไม่สำเร็จ', variant: 'destructive' }); } }}><Copy className="h-4 w-4" /></Button></div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 border-t border-gray-200 dark:border-gray-600 py-4">
                      <Calendar className="h-5 w-5 shrink-0" /><div className="flex-1"><Label htmlFor={`events-${config.id}`} className="font-medium">แจ้งเหตุการณ์</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">{config.notification_type === 'weekly'
                          ? `Weekly • ${(config.weekly_days || []).map(d => weekdays.find(w => w.value === d)?.label).filter(Boolean).join(', ')} • ${config.schedule_time} • ${config.weekly_scope === 'next' ? 'สัปดาห์หน้า' : 'สัปดาห์นี้'}`
                          : `Daily • ${config.notification_days === 0 ? 'Today' : config.notification_days === 1 ? 'Tomorrow' : `${config.notification_days} days ahead`} • ${config.schedule_time}`}</p></div>
                      <Switch id={`events-${config.id}`} className="data-[state=checked]:bg-green-500" checked={config.enabled} disabled={savingConfig !== null} onCheckedChange={enabled => void toggleNotification(config, { enabled })} />
                      <span className="text-sm hidden sm:block">{config.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                    </div>
                    <div className="flex items-center gap-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                      <Mic className="h-5 w-5 shrink-0" /><div className="flex-1"><Label htmlFor={`leader-${config.id}`} className="font-medium">การแจ้งเตือนผู้นำ daily meeting</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">วันทำงานแรกของสัปดาห์ • {rotation?.notificationTime || '09:00'}</p>
                        {config.daily_leader_enabled && leaderActive && next && <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">ครั้งถัดไป: {next.date} • {next.employeeName}</p>}
                      </div>
                      <Switch id={`leader-${config.id}`} className="data-[state=checked]:bg-green-500" checked={!!config.daily_leader_enabled} disabled={savingConfig !== null || !rotation} onCheckedChange={daily_leader_enabled => void toggleNotification(config, { daily_leader_enabled })} />
                      {config.daily_leader_enabled && !leaderActive ? <Badge variant="outline" className="text-amber-600 dark:text-amber-300">พักตามฟีเจอร์</Badge> : <span className="text-sm hidden sm:block">{config.daily_leader_enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>}
                    </div>
                  </CardContent>
                </Card>;
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Edit Cronjob Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Daily Notification"
                />
              </div>
              <div>
                <Label htmlFor="edit-schedule_time">Schedule Time <span className="text-red-500">*</span></Label>
                <div className="relative w-full">
                  <Input
                    id="edit-schedule_time"
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
                    className="w-full cursor-pointer pr-10"
                    style={{
                      colorScheme: theme === 'dark' ? 'dark' : 'light',
                      width: '100%'
                    }}
                    onClick={(e) => {
                      const input = e.currentTarget;
                      input.showPicker?.();
                    }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-webhook_url">Webhook URL <span className="text-red-500">*</span></Label>
                <Textarea
                  id="edit-webhook_url"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-notification_type">Notification Type <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.notification_type}
                  onValueChange={(value: 'daily' | 'weekly') => setFormData(prev => ({ ...prev, notification_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.notification_type === 'daily' && (
                <div>
                  <Label htmlFor="edit-notification_days">Notification Days <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.notification_days.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, notification_days: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Today</SelectItem>
                      <SelectItem value="1">Tomorrow</SelectItem>
                      <SelectItem value="2">2 days ahead</SelectItem>
                      <SelectItem value="3">3 days ahead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.notification_type === 'weekly' && (
                <>
                  <div>
                    <Label>Notification Days <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {weekdays.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-weekday-${day.value}`}
                            checked={formData.weekly_days.includes(day.value)}
                            onCheckedChange={(checked) => handleWeekdayToggle(day.value, !!checked)}
                          />
                          <Label htmlFor={`edit-weekday-${day.value}`} className="text-sm">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-weekly_scope">Week Scope <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.weekly_scope}
                      onValueChange={(value: 'current' | 'next') => setFormData(prev => ({ ...prev, weekly_scope: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">สัปดาห์นี้ (Current Week)</SelectItem>
                        <SelectItem value="next">สัปดาห์หน้า (Next Week)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="edit-enabled">Enabled</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate}>Update</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Test Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="test-message">Custom Message (Optional)</Label>
                <Textarea
                  id="test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter custom announcement message to replace the default one..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleTestSubmit}>
                  Send Test
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
