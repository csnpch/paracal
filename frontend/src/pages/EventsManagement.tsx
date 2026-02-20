import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiDatabase, Event, Employee } from '@/services/apiDatabase';
import { EventModal } from '@/components/EventModal';
import { Trash2, AlertTriangle, ChevronLeft, ChevronRight, X, Search, Calendar as CalendarIcon, Edit, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LEAVE_TYPE_LABELS } from '@/lib/utils';
import type { LeaveType } from '@/lib/utils';
import moment from 'moment';

const EventsManagement = () => {
  const { isAdminAuthenticated } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [eventsPerPage, setEventsPerPage] = useState(10);

  // Search and filter state
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchEmployeeInput, setSearchEmployeeInput] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Selection state
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Bulk delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteOption, setDeleteOption] = useState<'month' | 'year' | 'all'>('month');
  const [password, setPassword] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(moment().month() + 1);
  const [selectedYear, setSelectedYear] = useState(moment().year());
  const [yearForDeletion, setYearForDeletion] = useState(moment().year() - 1);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const apiDb = getApiDatabase();

  useEffect(() => {
    if (!isAdminAuthenticated) {
      return;
    }
    loadData();
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterEvents();
  }, [events, searchEmployee, startDateFilter, endDateFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, employeesData] = await Promise.all([
        apiDb.getAllEvents(),
        apiDb.getAllEmployees()
      ]);

      setEvents(eventsData || []);
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Multi-field OR search
    if (searchEmployee.trim()) {
      const searchTerm = searchEmployee.toLowerCase();
      filtered = filtered.filter(event => {
        // Get employee name
        const employeeName = getEmployeeName(event.employeeId).toLowerCase();

        // Get leave type in Thai
        const leaveTypeThai = getLeaveTypeName(event.leaveType).toLowerCase();

        // Get formatted dates
        const startDate = formatDate(event.startDate);
        const endDate = formatDate(event.endDate);

        // Get raw dates for additional search options
        const rawStartDate = event.startDate; // YYYY-MM-DD format
        const rawEndDate = event.endDate;

        // Get month/year variations
        const startYear = moment(event.startDate).format('YYYY');
        const endYear = moment(event.endDate).format('YYYY');
        const startMonth = moment(event.startDate).format('MM');
        const endMonth = moment(event.endDate).format('MM');

        // Get description
        const description = (event.description || '').toLowerCase();

        // Check if search term matches any field (OR condition)
        return employeeName.includes(searchTerm) ||
          leaveTypeThai.includes(searchTerm) ||
          (startDate || '').includes(searchTerm) ||
          (endDate || '').includes(searchTerm) ||
          (rawStartDate || '').includes(searchTerm) ||
          (rawEndDate || '').includes(searchTerm) ||
          (startYear || '').includes(searchTerm) ||
          (endYear || '').includes(searchTerm) ||
          (startMonth || '').includes(searchTerm) ||
          (endMonth || '').includes(searchTerm) ||
          description.includes(searchTerm) ||
          (event.leaveType || '').toLowerCase().includes(searchTerm); // Also search original leave type
      });
    }

    // Filter by date range (separate from text search)
    if (startDateFilter || endDateFilter) {
      filtered = filtered.filter(event => {
        const eventStart = moment(event.startDate);
        const eventEnd = moment(event.endDate);

        if (startDateFilter && endDateFilter) {
          const filterStart = moment(startDateFilter);
          const filterEnd = moment(endDateFilter);
          return eventStart.isSameOrAfter(filterStart) && eventEnd.isSameOrBefore(filterEnd);
        } else if (startDateFilter) {
          const filterStart = moment(startDateFilter);
          return eventStart.isSameOrAfter(filterStart);
        } else if (endDateFilter) {
          const filterEnd = moment(endDateFilter);
          return eventEnd.isSameOrBefore(filterEnd);
        }
        return true;
      });
    }

    setFilteredEvents(filtered);
    setCurrentPage(1);
    setSelectedEvents(new Set());
    setSelectAll(false);
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee?.name || 'ไม่ทราบชื่อ';
  };

  const getLeaveTypeName = (leaveType: string) => {
    return LEAVE_TYPE_LABELS[leaveType as LeaveType] || leaveType;
  };

  const formatDate = (dateString: string) => {
    return moment(dateString).format('DD/MM/YYYY');
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const currentEventIds = new Set(currentEvents.map(event => event.id));
      setSelectedEvents(currentEventIds);
    } else {
      setSelectedEvents(new Set());
    }
  };

  const handleSelectEvent = (eventId: number, checked: boolean) => {
    const newSelected = new Set(selectedEvents);
    if (checked) {
      newSelected.add(eventId);
    } else {
      newSelected.delete(eventId);
    }
    setSelectedEvents(newSelected);
    setSelectAll(newSelected.size === currentEvents.length && currentEvents.length > 0);
  };

  const handleDeleteSelected = async () => {
    if (selectedEvents.size === 0) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณาเลือกเหตุการณ์ที่ต้องการลบ",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`คุณต้องการลบเหตุการณ์ที่เลือก ${selectedEvents.size} รายการหรือไม่?`)) return;

    try {
      let deletedCount = 0;
      for (const eventId of selectedEvents) {
        const success = await apiDb.deleteEvent(eventId);
        if (success) {
          deletedCount++;
        }
      }

      toast({
        title: "สำเร็จ",
        description: `ลบเหตุการณ์สำเร็จ ${deletedCount} รายการ`,
      });

      setSelectedEvents(new Set());
      setSelectAll(false);
      await loadData();

    } catch (error) {
      console.error('Failed to delete selected events:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการลบเหตุการณ์",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!password) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณากรอกรหัสผ่าน",
        variant: "destructive",
      });
      return;
    }

    // Password is validated by the backend API

    setDeleting(true);

    try {
      let result: { deletedCount: number };

      if (deleteOption === 'month') {
        result = await apiDb.deleteEventsByMonth(selectedYear, selectedMonth, password);
      } else if (deleteOption === 'year') {
        result = await apiDb.deleteEventsByYear(yearForDeletion, password);
      } else {
        result = await apiDb.deleteAllEvents(password);
      }

      toast({
        title: "สำเร็จ",
        description: `ลบเหตุการณ์สำเร็จ ${result.deletedCount} รายการ`,
      });

      setShowDeleteDialog(false);
      setPassword('');
      setSelectedEvents(new Set());
      setSelectAll(false);
      await loadData();

    } catch (error) {
      console.error('Failed to delete events:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการลบเหตุการณ์",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingleEvent = async (eventId: number) => {
    if (!confirm('คุณต้องการลบเหตุการณ์นี้หรือไม่?')) return;

    try {
      const success = await apiDb.deleteEvent(eventId);
      if (success) {
        toast({
          title: "สำเร็จ",
          description: "ลบเหตุการณ์เรียบร้อยแล้ว",
        });
        await loadData();
      } else {
        toast({
          title: "ข้อผิดพลาด",
          description: "ไม่สามารถลบเหตุการณ์ได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการลบเหตุการณ์",
        variant: "destructive",
      });
    }
  };

  const handleSearch = () => {
    setSearchEmployee(searchEmployeeInput);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchEmployee('');
    setSearchEmployeeInput('');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleEventSave = async (eventData: {
    employeeId: number;
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    description?: string;
  }) => {
    try {
      if (editingEvent) {
        const success = await apiDb.updateEvent(editingEvent.id, {
          employeeId: eventData.employeeId,
          leaveType: eventData.leaveType as any,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        });

        if (success) {
          toast({
            title: "สำเร็จ",
            description: "แก้ไขเหตุการณ์เรียบร้อยแล้ว",
          });
          setShowEditModal(false);
          setEditingEvent(null);
          await loadData();
        } else {
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถแก้ไขเหตุการณ์ได้",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Failed to update event:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการแก้ไขเหตุการณ์",
        variant: "destructive",
      });
    }
  };

  // Pagination
  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = filteredEvents.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setSelectedEvents(new Set());
    setSelectAll(false);
  };

  if (!isAdminAuthenticated) {
    return (
      <Layout currentPage="events-management">
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาเข้าสู่ระบบ Management ก่อน
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="events-management">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-normal">จัดการเหตุการณ์</CardTitle>
            <div className="flex gap-2">
              {selectedEvents.size > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  variant="outline"
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                  ลบที่เลือก ({selectedEvents.size})
                </Button>
              )}
              {filteredEvents.length > 0 && (
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="outline"
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <X className="w-3 h-3" />
                  ลบทั้งหมด
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="ค้นหาชื่อพนักงาน, ประเภทการลา, วันที่, หมายเหตุ..."
                        value={searchEmployeeInput}
                        onChange={(e) => setSearchEmployeeInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-10"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        data-form-type="other"
                        name="employee_search_field_unique"
                        id="employee_search_field_unique"
                      />
                    </div>
                    <Button onClick={handleSearch} variant="outline">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Input
                      type="date"
                      placeholder="วันที่เริ่มต้น"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="pr-10"
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <Input
                      type="date"
                      placeholder="วันที่สิ้นสุด"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="pr-10"
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                  {(searchEmployeeInput || searchEmployee || startDateFilter || endDateFilter) && (
                    <Button onClick={clearFilters} variant="outline" size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-gray-600">
                  แสดงผล {filteredEvents.length} จากทั้งหมด {events.length} รายการ
                  {searchEmployee && (
                    <span className="ml-2 text-blue-600">
                      (ค้นหา: "{searchEmployee}")
                    </span>
                  )}
                </div>
                {!searchEmployee && !startDateFilter && !endDateFilter && (
                  <div className="text-xs text-gray-500">
                    💡 เคล็ดลับ: ค้นหาได้ด้วย ชื่อ, ลาป่วย, 2024, 01/12, หมายเหตุ เป็นต้น
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">กำลังโหลด...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {events.length === 0 ? 'ไม่มีเหตุการณ์' : 'ไม่พบเหตุการณ์ที่ตรงกับการค้นหา'}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-16">No.</TableHead>
                      <TableHead>ชื่อพนักงาน</TableHead>
                      <TableHead>ประเภทการลา</TableHead>
                      <TableHead>วันที่เริ่ม</TableHead>
                      <TableHead>วันที่สิ้นสุด</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead>การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentEvents.map((event, index) => (
                      <TableRow key={event.id} className="h-10">
                        <TableCell className="py-2">
                          <Checkbox
                            checked={selectedEvents.has(event.id)}
                            onCheckedChange={(checked) => handleSelectEvent(event.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="py-2 text-center text-sm text-gray-500">
                          {indexOfFirstEvent + index + 1}
                        </TableCell>
                        <TableCell className="font-normal py-2">{getEmployeeName(event.employeeId)}</TableCell>
                        <TableCell className="py-2">{getLeaveTypeName(event.leaveType)}</TableCell>
                        <TableCell className="py-2">{formatDate(event.startDate)}</TableCell>
                        <TableCell className="py-2">{formatDate(event.endDate)}</TableCell>
                        <TableCell className="py-2">{event.description || '-'}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex gap-1">
                            <Button
                              onClick={() => handleEditEvent(event)}
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteSingleEvent(event.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>แสดงรายการที่ {indexOfFirstEvent + 1} - {Math.min(indexOfLastEvent, filteredEvents.length)} จาก {filteredEvents.length} รายการ</span>
                    <div className="flex items-center gap-2">
                      <span>แสดง</span>
                      <Select value={eventsPerPage.toString()} onValueChange={(value) => {
                        setEventsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>รายการต่อหน้า</span>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        ก่อนหน้า
                      </Button>

                      <span className="text-sm text-gray-600 px-3">
                        หน้า {currentPage} จาก {totalPages}
                      </span>

                      <Button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        ถัดไป
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bulk Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-[999] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>ลบเหตุการณ์</DialogTitle>
                <DialogDescription>
                  เลือกประเภทการลบเหตุการณ์ และกรอกรหัสผ่านเพื่อยืนยัน
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">ประเภทการลบ</label>
                  <Select value={deleteOption} onValueChange={(value: 'month' | 'year' | 'all') => setDeleteOption(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">ลบภายในเดือนที่กำหนด</SelectItem>
                      <SelectItem value="year">ลบภายในปีที่กำหนด</SelectItem>
                      <SelectItem value="all">ลบทั้งหมด</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {deleteOption === 'month' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium">เดือน</label>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {moment().month(i).format('MMMM')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">ปี</label>
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => {
                            const year = moment().year() - 2 + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {deleteOption === 'year' && (
                  <div>
                    <label className="text-sm font-medium">ปี</label>
                    <Select value={yearForDeletion.toString()} onValueChange={(value) => setYearForDeletion(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = moment().year() - 2 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">PIN ยืนยัน (6 หลัก)</label>
                  <div className="flex justify-center items-center space-x-2 relative w-fit mx-auto mt-2">
                    <InputOTP
                      id="password"
                      maxLength={6}
                      value={password}
                      onChange={(val) => setPassword(val)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} hideChar={!showPassword} />
                        <InputOTPSlot index={1} hideChar={!showPassword} />
                        <InputOTPSlot index={2} hideChar={!showPassword} />
                        <InputOTPSlot index={3} hideChar={!showPassword} />
                        <InputOTPSlot index={4} hideChar={!showPassword} />
                        <InputOTPSlot index={5} hideChar={!showPassword} />
                      </InputOTPGroup>
                    </InputOTP>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute -right-10 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setPassword('');
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={deleting || !password}
                >
                  {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Edit Event Modal */}
        <EventModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingEvent(null);
          }}
          onSave={handleEventSave}
          selectedDate={editingEvent ? new Date(editingEvent.startDate) : null}
          employees={employees}
          editingEvent={editingEvent}
        />
      </div>
    </Layout>
  );
};

export default EventsManagement;