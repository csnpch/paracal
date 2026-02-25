import { getPrisma } from '../database/connection';
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '../types';
import moment from 'moment';

export class EmployeeService {
  private get prisma() { return getPrisma(); }

  async createEmployee(data: CreateEmployeeRequest): Promise<Employee> {
    const now = moment().utcOffset('+07:00').toDate();
    const employee = await this.prisma.employee.create({
      data: {
        name: data.name,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      id: employee.id,
      name: employee.name,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }

  async getAllEmployees(): Promise<Employee[]> {
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  }

  async getEmployeeById(id: number): Promise<Employee | null> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) return null;

    return {
      id: employee.id,
      name: employee.name,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }

  async updateEmployee(id: number, data: UpdateEmployeeRequest): Promise<Employee | null> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) return null;

    const now = moment().utcOffset('+07:00').toDate();
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        name: data.name || existing.name,
        updatedAt: now,
      },
    });

    return {
      id: employee.id,
      name: employee.name,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }

  async deleteEmployee(id: number): Promise<boolean> {
    try {
      await this.prisma.employee.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async searchEmployees(query: string): Promise<Employee[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  }

  async getEmployeeStats() {
    const total = await this.prisma.employee.count();
    return { total };
  }
}