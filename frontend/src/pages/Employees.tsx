import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Search, Users } from 'lucide-react';
import { useCalendarData } from '@/hooks/useCalendarData';
import { Employee } from '@/services/apiDatabase';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';

interface EmployeeFormData {
  name: string;
}

export const Employees = () => {
  const { employees, addEmployee, updateEmployee, deleteEmployee, searchEmployees } = useCalendarData();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: ''
  });

  useEffect(() => {
    const filterEmployees = async () => {
      if (searchQuery) {
        const result = await searchEmployees(searchQuery);
        setFilteredEmployees(Array.isArray(result) ? result : []);
      } else {
        setFilteredEmployees(employees);
      }
    };
    filterEmployees();
  }, [searchQuery, employees, searchEmployees]);

  useEffect(() => {
    if (isFormOpen) nameInputRef.current?.focus();
  }, [isFormOpen, editingEmployee]);

  const resetForm = () => {
    setFormData({
      name: ''
    });
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกชื่อ-นามสกุล",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, formData);
        toast({
          title: "อัพเดทข้อมูลเรียบร้อย",
          description: `อัพเดทข้อมูลของ ${formData.name} เรียบร้อยแล้ว`,
          variant: "success",
        });
      } else {
        await addEmployee(formData);
        toast({
          title: "เพิ่มพนักงานเรียบร้อย",
          description: `เพิ่ม ${formData.name} เข้าระบบเรียบร้อยแล้ว`,
          variant: "success",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`คุณต้องการลบข้อมูลของ ${employee.name} หรือไม่?`)) {
      try {
        await deleteEmployee(employee.id);
        toast({
          title: "ลบข้อมูลเรียบร้อย",
          description: `ลบข้อมูลของ ${employee.name} เรียบร้อยแล้ว`,
          variant: "success",
        });
      } catch (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถลบข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData({ name: employee.name });
    setEditingEmployee(employee);
    setIsFormOpen(true);
    nameInputRef.current?.focus();
  };

  return (
    <Layout currentPage="employees">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
        <div className="mb-6">
          <h2 className="text-xl font-normal text-gray-900 dark:text-white mb-2">จัดการข้อมูลพนักงาน</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">เพิ่ม แก้ไข และลบข้อมูลพนักงาน</p>
        </div>

        <div className="space-y-6">
          {/* Search and Add Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="ค้นหาพนักงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มพนักงาน
            </Button>
          </div>

          {/* Employee Form */}
          {isFormOpen && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingEmployee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className='flex flex-col gap-y-2'>
                    <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                    <Input
                      id="name"
                      ref={nameInputRef}
                      value={formData.name}
                      onChange={(e) => setFormData({name: e.target.value})}
                      placeholder="กรอกชื่อ-นามสกุล"
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      ยกเลิก
                    </Button>
                    <Button type="submit">
                      {editingEmployee ? 'อัพเดท' : 'เพิ่ม'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Employee List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>รายชื่อพนักงาน</span>
                <Badge variant="secondary" className="ml-2">
                  {filteredEmployees.length} คน
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-gray-900 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="font-normal text-gray-900 dark:text-white">{employee.name}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`แก้ไขข้อมูล ${employee.name}`}
                          onClick={() => handleEdit(employee)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`ลบข้อมูล ${employee.name}`}
                          onClick={() => handleDelete(employee)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>ไม่พบข้อมูลพนักงาน</p>
                    {searchQuery && (
                      <p className="text-sm mt-1">ลองเปลี่ยนคำค้นหาใหม่</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="bg-blue-50 dark:bg-gray-900/20 border border-blue-200 dark:border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              จำนวนพนักงานทั้งหมด: {employees.length} คน
              {searchQuery && ` (แสดง ${filteredEmployees.length} คน)`}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};
