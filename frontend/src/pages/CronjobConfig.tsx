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
import {
  getCronjobConfigs,
  getCronjobStatus,
  createCronjobConfig,
  updateCronjobConfig,
  deleteCronjobConfig,
  testCronjobNotification,
  type CronjobConfig,
  type CronjobStatus
} from '../services/api';
import {
  Trash2,
  Edit,
  Play,
  Plus,
  RotateCcw,
  Loader2
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
      const [configResponse, statusResponse] = await Promise.all([
        getCronjobConfigs(),
        getCronjobStatus()
      ]);

      if (configResponse.success && configResponse.data) {
        setConfigs(configResponse.data);
      }

      if (statusResponse.success && statusResponse.data) {
        setStatuses(statusResponse.data);
      }
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
      const [configResponse, statusResponse] = await Promise.all([
        getCronjobConfigs(),
        getCronjobStatus()
      ]);

      if (configResponse.success && configResponse.data) {
        setConfigs(configResponse.data);
      }

      if (statusResponse.success && statusResponse.data) {
        setStatuses(statusResponse.data);
      }

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

  const handleTest = async (id: number) => {
    try {
      const response = await testCronjobNotification(id);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Test notification sent successfully',
          variant: 'success'
        });
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

  const handleToggleEnabled = async (config: CronjobConfig, enabled: boolean) => {
    try {
      const response = await updateCronjobConfig(config.id, { enabled });
      if (response.success) {
        toast({
          title: 'Success',
          description: `Cronjob ${enabled ? 'enabled' : 'disabled'} successfully`,
          variant: 'success'
        });
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
    const isEnabled = status ? status.enabled : config.enabled;
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
              <DialogContent className="max-w-md">
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

        <div className="grid gap-4">
          {configs.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No cronjob configurations found. Create your first one!</p>
              </CardContent>
            </Card>
          ) : (
            configs
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((config) => (
                <Card key={config.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CardTitle className="text-lg text-gray-900 dark:text-white">{config.name}</CardTitle>
                        {getStatusBadge(config)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={(checked) => handleToggleEnabled(config, checked)}
                        />
                        <Button size="sm" variant="outline" onClick={() => handleTest(config.id)}>
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(config)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(config.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-normal text-gray-700 dark:text-gray-300">Schedule</p>
                        <p className="text-gray-900 dark:text-white">{config.schedule_time}</p>
                      </div>
                      <div>
                        <p className="font-normal text-gray-700 dark:text-gray-300">Notification Type</p>
                        <p className="text-gray-900 dark:text-white">
                          {config.notification_type === 'weekly' ? 'Weekly' : 'Daily'}
                        </p>
                      </div>
                      <div>
                        <p className="font-normal text-gray-700 dark:text-gray-300">
                          {config.notification_type === 'weekly' ? 'Weekly Scope' : 'Notification Days'}
                        </p>
                        <p className="text-gray-900 dark:text-white">
                          {config.notification_type === 'weekly'
                            ? (config.weekly_scope === 'current' ? 'สัปดาห์นี้' : 'สัปดาห์หน้า')
                            : (config.notification_days === -1 ? 'Today' :
                              config.notification_days === 0 ? 'Tomorrow' :
                                `${config.notification_days + 1} days ahead`)
                          }
                        </p>
                      </div>
                      <div>
                        <p className="font-normal text-gray-700 dark:text-gray-300">Created</p>
                        <p className="text-gray-900 dark:text-white">{new Date(config.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="font-normal text-gray-700 dark:text-gray-300">Updated</p>
                        <p className="text-gray-900 dark:text-white">{new Date(config.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {config.notification_type === 'weekly' && config.weekly_days && config.weekly_days.length > 0 && (
                      <div className="mt-3">
                        <p className="font-normal text-gray-700 dark:text-gray-300 mb-1">Notification Days</p>
                        <div className="flex flex-wrap gap-1">
                          {config.weekly_days.map(dayValue => {
                            const day = weekdays.find(w => w.value === dayValue);
                            return day ? (
                              <Badge key={dayValue} variant="secondary" className="text-xs">
                                {day.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <p className="font-normal text-gray-700 dark:text-gray-300 mb-1">Webhook URL</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 break-all bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        {config.webhook_url}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
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
      </div>
    </Layout>
  );
}