import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAllCompanyHolidays,
  createMultipleCompanyHolidays,
  updateCompanyHoliday,
  deleteCompanyHoliday,
  clearAllCompanyHolidays,
  type CompanyHoliday
} from '@/services/companyHolidayService';
import { Plus, Trash2, Edit, Calendar as CalendarIcon, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import moment from 'moment';

interface HolidayFormData {
  name: string;
  date: string;
  description: string;
  dateError?: boolean;
}

const CompanyHolidays: React.FC = () => {
  const { isAdminAuthenticated } = useAuth();
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<CompanyHoliday | null>(null);
  const [holidayRows, setHolidayRows] = useState<HolidayFormData[]>([
    { name: '', date: '', description: '', dateError: false }
  ]);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const data = await fetchAllCompanyHolidays();
      setHolidays(data);
    } catch (error) {
      console.error('Error loading company holidays:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลวันหยุดบริษัทได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateDateFormat = (date: string): boolean => {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(date)) return false;

    const parts = date.split('/');
    if (parts.length !== 3) return false;
    const [day, month, year] = parts.map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.getDate() === day &&
      dateObj.getMonth() === month - 1 &&
      dateObj.getFullYear() === year;
  };

  const formatDateForAPI = (date: string): string => {
    const parts = date.split('/');
    if (parts.length !== 3) return date;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const formatDateForDisplay = (date: string): string => {
    const parts = date.split('-');
    if (parts.length !== 3) return date;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const addHolidayRow = () => {
    setHolidayRows([...holidayRows, { name: '', date: '', description: '', dateError: false }]);
  };

  const removeHolidayRow = (index: number) => {
    if (holidayRows.length > 1) {
      setHolidayRows(holidayRows.filter((_, i) => i !== index));
    }
  };

  const updateHolidayRow = (index: number, field: 'name' | 'date' | 'description', value: string) => {
    const updatedRows = [...holidayRows];
    updatedRows[index] = { ...updatedRows[index], [field]: value };
    // Clear date error when user types
    if (field === 'date') {
      updatedRows[index].dateError = false;
    }
    setHolidayRows(updatedRows);
  };

  const handleDateBlur = (index: number, date: string) => {
    const updatedRows = [...holidayRows];
    if (date && !validateDateFormat(date)) {
      updatedRows[index].dateError = true;
      setHolidayRows(updatedRows);
      toast({
        title: "รูปแบบวันที่ไม่ถูกต้อง",
        description: "กรุณาใส่วันที่ในรูปแบบ DD/MM/YYYY",
        variant: "destructive",
      });
    } else {
      updatedRows[index].dateError = false;
      setHolidayRows(updatedRows);
    }
  };

  const handleSaveHolidays = async () => {
    const validHolidays = holidayRows.filter(row =>
      row.name.trim() && row.date.trim() && validateDateFormat(row.date)
    );

    if (validHolidays.length === 0) {
      toast({
        title: "ข้อมูลไม่ถูกต้อง",
        description: "กรุณาใส่ข้อมูลวันหยุดอย่างน้อย 1 วัน",
        variant: "destructive",
      });
      return;
    }

    try {
      const holidaysToCreate = validHolidays.map(row => ({
        name: row.name.trim(),
        date: formatDateForAPI(row.date),
        description: row.description.trim() || undefined
      }));

      await createMultipleCompanyHolidays(holidaysToCreate);

      toast({
        title: "สำเร็จ",
        description: `เพิ่มวันหยุดบริษัท ${holidaysToCreate.length} วันเรียบร้อยแล้ว`,
      });

      setIsDialogOpen(false);
      setHolidayRows([{ name: '', date: '', description: '', dateError: false }]);
      loadHolidays();
    } catch (error) {
      console.error('Error creating holidays:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถเพิ่มวันหยุดบริษัทได้",
        variant: "destructive",
      });
    }
  };

  const handleEditHoliday = async () => {
    if (!editingHoliday) return;

    const row = holidayRows[0];
    if (!row.name.trim() || !row.date.trim() || !validateDateFormat(row.date)) {
      toast({
        title: "ข้อมูลไม่ถูกต้อง",
        description: "กรุณาใส่ข้อมูลให้ครบถ้วนและถูกต้อง",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateCompanyHoliday(editingHoliday.id, {
        name: row.name.trim(),
        date: formatDateForAPI(row.date),
        description: row.description.trim() || undefined
      });

      toast({
        title: "สำเร็จ",
        description: "แก้ไขวันหยุดบริษัทเรียบร้อยแล้ว",
      });

      setIsDialogOpen(false);
      setEditingHoliday(null);
      setHolidayRows([{ name: '', date: '', description: '' }]);
      loadHolidays();
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถแก้ไขวันหยุดบริษัทได้",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('คุณต้องการลบวันหยุดนี้หรือไม่?')) return;

    try {
      await deleteCompanyHoliday(id);

      toast({
        title: "สำเร็จ",
        description: "ลบวันหยุดบริษัทเรียบร้อยแล้ว",
      });

      loadHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถลบวันหยุดบริษัทได้",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (holiday: CompanyHoliday) => {
    setEditingHoliday(holiday);
    setHolidayRows([{
      name: holiday.name,
      date: formatDateForDisplay(holiday.date),
      description: holiday.description || '',
      dateError: false
    }]);
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingHoliday(null);
    setHolidayRows([{ name: '', date: '', description: '', dateError: false }]);
    setIsDialogOpen(true);
  };

  const handleClearAllHolidays = async () => {
    if (!confirm('คุณต้องการลบวันหยุดบริษัททั้งหมดหรือไม่? การกระทำนี้ไม่สามารถกู้คืนได้')) return;

    try {
      const result = await clearAllCompanyHolidays();

      toast({
        title: "สำเร็จ",
        description: `ลบวันหยุดบริษัททั้งหมด ${result.count} วันเรียบร้อยแล้ว`,
      });

      loadHolidays();
    } catch (error) {
      console.error('Error clearing all holidays:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถลบวันหยุดบริษัททั้งหมดได้",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout currentPage="company-holidays">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-normal">วันหยุดบริษัท</CardTitle>
            {isAdminAuthenticated && (
              <div className="flex gap-2">
                {holidays.length > 0 && (
                  <Button
                    onClick={handleClearAllHolidays}
                    variant="outline"
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <X className="w-3 h-3" />
                    ลบทั้งหมด
                  </Button>
                )}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddDialog} className="flex items-center gap-2">
                      <Plus className="w-3 h-3" />
                      เพิ่มวันหยุด
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingHoliday ? 'แก้ไขวันหยุดบริษัท' : 'เพิ่มวันหยุดบริษัท'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-0">
                      <div>
                        {holidayRows.map((row, index) => (
                          <div key={index} className="flex gap-3 items-start h-14">
                            <div className="flex-1">
                              <Input
                                placeholder="ชื่อวันหยุด"
                                value={row.name}
                                onChange={(e) => updateHolidayRow(index, 'name', e.target.value)}
                              />
                            </div>
                            <div className="flex-1 relative">
                              <Input
                                placeholder={`DD/MM/YYYY, eg. ${moment().format('DD/MM/YYYY')}`}
                                value={row.date}
                                onChange={(e) => updateHolidayRow(index, 'date', e.target.value)}
                                onBlur={(e) => handleDateBlur(index, e.target.value)}
                                className={row.dateError ? 'border-red-500 focus:border-red-500' : ''}
                              />
                              <input
                                type="date"
                                className="absolute opacity-0 pointer-events-none"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const date = new Date(e.target.value);
                                    const formattedDate = String(date.getDate()).padStart(2, '0') + '/' +
                                      String(date.getMonth() + 1).padStart(2, '0') + '/' +
                                      date.getFullYear();
                                    updateHolidayRow(index, 'date', formattedDate);
                                  }
                                }}
                                ref={(ref) => {
                                  if (ref) {
                                    (ref.parentElement as any).datePicker = ref;
                                  }
                                }}
                              />
                              <CalendarIcon
                                className="absolute right-2 w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 z-10"
                                style={{ top: '12px' }}
                                onClick={(e) => {
                                  const datePicker = (e.currentTarget.parentElement as any).datePicker;
                                  if (datePicker) {
                                    datePicker.showPicker?.();
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <Input
                                placeholder="หมายเหตุ (ไม่บังคับ)"
                                value={row.description}
                                onChange={(e) => updateHolidayRow(index, 'description', e.target.value)}
                              />
                            </div>
                            {!editingHoliday && holidayRows.length > 1 && (
                              <Button
                                onClick={() => removeHolidayRow(index)}
                                variant="outline"
                                size="sm"
                                className="px-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {!editingHoliday && (
                        <div className="w-full -mt-12">
                          <Button onClick={addHolidayRow} variant="outline" size="sm" className="w-full">
                            <Plus className="w-3 h-3 mr-1" />
                            เพิ่มแถว
                          </Button>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 !mt-4">
                        <Button
                          onClick={() => setIsDialogOpen(false)}
                          variant="outline"
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          onClick={editingHoliday ? handleEditHoliday : handleSaveHolidays}
                        >
                          {editingHoliday ? 'บันทึก' : 'เพิ่มวันหยุด'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">กำลังโหลด...</div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ไม่มีวันหยุดบริษัท
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อวันหยุด</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    {isAdminAuthenticated && <TableHead>การจัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id} className="h-10">
                      <TableCell className="font-normal py-2">{holiday.name}</TableCell>
                      <TableCell className="py-2">{formatDateForDisplay(holiday.date)}</TableCell>
                      <TableCell className="py-2">{holiday.description || '-'}</TableCell>
                      {isAdminAuthenticated && (
                        <TableCell className="py-2">
                          <div className="flex gap-1">
                            <Button
                              onClick={() => openEditDialog(holiday)}
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CompanyHolidays;