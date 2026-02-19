import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginModal } from './AdminLoginModal';
import {
  CalendarDays,
  Building2,
  Users,
  Settings,
  MoreVertical,
  Moon,
  Sun,
  Shield,
  LayoutDashboard,
  LogOut,
  Calendar,
  FileText
} from 'lucide-react';

interface NavbarProps {
  currentPage?: 'calendar-events' | 'dashboard' | 'employees' | 'cronjob-config' | 'company-holidays' | 'events-management';
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage = 'calendar-events' }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAdminAuthenticated, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isCurrentPage = (page: string) => currentPage === page;

  const getButtonClasses = (page: string) => {
    if (isCurrentPage(page)) {
      return "text-blue-600 hover:text-blue-700 dark:text-gray-200 dark:hover:text-white font-normal";
    }
    return "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-600">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-2 md:py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center space-x-0.5 sm:space-x-1.5 md:space-x-2.5 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div className="p-1.5 sm:p-2 md:p-3 bg-blue-100 dark:bg-gray-700 rounded-lg">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-600 dark:text-gray-200" />
            </div>
            <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">Paracal</h1>
          </Button>

          {/* Navigation Menu */}
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              {isAdminAuthenticated && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/dashboard')}
                    className={getButtonClasses('dashboard')}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    แดชบอร์ด
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className={getButtonClasses('calendar-events')}
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    ปฏิทินเหตุการณ์
                  </Button>
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 border-gray-200 dark:border-gray-600"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-2">
                  {!isAdminAuthenticated ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate('/company-holidays')}
                        className="px-4 py-3"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        วันหยุดบริษัท
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowLoginModal(true)}
                        className="px-4 py-3"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Management
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate('/company-holidays')}
                        className="px-4 py-3"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        วันหยุดบริษัท
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/events-management')}
                        className="px-4 py-3"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        จัดการเหตุการณ์
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/employees')}
                        className="px-4 py-3"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        จัดการพนักงาน
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/cronjob-config')}
                        className="px-4 py-3"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        ตั้งค่า Cronjob
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { logout(); navigate('/'); }} className="px-4 py-3 text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 border-gray-200 dark:border-gray-600"
              >
                {theme === 'dark' ?
                  <Sun className="w-4 h-4" /> :
                  <Moon className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AdminLoginModal
        key={showLoginModal ? 'open' : 'closed'}
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
        }}
        onSuccess={() => {
          setShowLoginModal(false);
        }}
      />
    </div>
  );
};

export default Navbar;
