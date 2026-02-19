
import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { createCompanyHoliday } from '@/services/companyHolidayService';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import moment from 'moment';

interface CreateEventPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEvent: () => void;
  onHolidayAdded?: () => void;
  selectedDate: Date | null;
  triggerElement: React.ReactNode;
  isRangeSelection?: boolean;
  showHolidayDialog?: boolean;
  onHolidayDialogChange?: (open: boolean, date?: Date | null) => void;
}

export const CreateEventPopover: React.FC<CreateEventPopoverProps> = ({
  isOpen,
  onOpenChange,
  onCreateEvent,
  onHolidayAdded,
  selectedDate,
  triggerElement,
  isRangeSelection = false,
  showHolidayDialog = false,
  onHolidayDialogChange
}) => {
  const { isAdminAuthenticated } = useAuth();
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');
  const [holidayDate, setHolidayDate] = useState<Date | null>(null);


  const handleCreateEvent = () => {
    onCreateEvent();
    onOpenChange(false);
  };

  const handleAddHoliday = () => {
    setHolidayDate(selectedDate);
    onHolidayDialogChange?.(true, selectedDate);

    setTimeout(() => {
      onOpenChange(false);
    }, 50);
  };

  const formatDateForAPI = (date: Date): string => {
    // Use getFullYear, getMonth, getDate to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;
    console.log('Formatting date for API:', {
      original: date,
      year,
      month: date.getMonth() + 1,
      day: date.getDate(),
      formatted
    });
    return formatted;
  };

  const handleSaveHoliday = async () => {
    console.log('Saving holiday:', { holidayDate, holidayName: holidayName.trim() }); // Debug log

    if (!holidayDate) {
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่พบวันที่ที่เลือก",
        variant: "destructive",
      });
      return;
    }

    if (!holidayName.trim()) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณาใส่ชื่อวันหยุด",
        variant: "destructive",
      });
      return;
    }

    try {
      await createCompanyHoliday({
        name: holidayName.trim(),
        date: formatDateForAPI(holidayDate),
        description: holidayDescription.trim() || undefined
      });

      toast({
        title: "สำเร็จ",
        description: "เพิ่มวันหยุดบริษัทเรียบร้อยแล้ว",
      });

      onHolidayDialogChange?.(false);
      setHolidayDate(null);
      setHolidayName('');
      setHolidayDescription('');

      if (onHolidayAdded) {
        onHolidayAdded();
      }
    } catch (error) {
      console.error('Error creating holiday:', error);
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถเพิ่มวันหยุดบริษัทได้",
        variant: "destructive",
      });
    }
  };

  const handleCancelHoliday = () => {
    onHolidayDialogChange?.(false);
    setHolidayDate(null);
    setHolidayName('');
    setHolidayDescription('');
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          {triggerElement}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="center" side="bottom">
          <div className="p-4">
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(selectedDate)}</p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleCreateEvent}
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                variant="ghost"
              >
                <Plus className="w-4 h-4 mr-2" />
                สร้างเหตุการณ์ใหม่
              </Button>

              {isAdminAuthenticated && !isRangeSelection && (
                <Button
                  onClick={handleAddHoliday}
                  className="w-full justify-start text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
                  variant="ghost"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  เพิ่มเป็นวันหยุดบริษัท
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>


      {/* Holiday modal */}
      {showHolidayDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            visibility: 'visible',
            opacity: 1
          }}
          onClick={() => {
            onHolidayDialogChange?.(false);
            setHolidayDate(null);
            setHolidayName('');
            setHolidayDescription('');
          }}
        >
          <div
            style={{
              backgroundColor: 'white !important',
              padding: '24px !important',
              borderRadius: '8px !important',
              maxWidth: '400px !important',
              width: '90% !important',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1) !important',
              border: '2px solid red !important'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
              เพิ่มวันหยุดบริษัท
            </h2>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              วันที่: {formatDate(holidayDate)}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>ชื่อวันหยุด:</label>
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="เช่น วันหยุดบริษัท"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>คำอธิบาย:</label>
              <input
                type="text"
                value={holidayDescription}
                onChange={(e) => setHolidayDescription(e.target.value)}
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  onHolidayDialogChange?.(false);
                  setHolidayDate(null);
                  setHolidayName('');
                  setHolidayDescription('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveHoliday}
                disabled={!holidayName.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: holidayName.trim() ? 'pointer' : 'not-allowed',
                  opacity: holidayName.trim() ? 1 : 0.5
                }}
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
