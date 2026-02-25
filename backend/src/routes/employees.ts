import { Elysia, t } from 'elysia';
import { EmployeeService } from '../services/employeeService';
import { logService } from '../services/logService';
import Logger from '../utils/logger';

const employeeService = new EmployeeService();

export const employeesRoutes = new Elysia({ prefix: '/employees' })
  .get('/', async () => await employeeService.getAllEmployees())
  
  .get('/:id', async ({ params: { id } }) => {
    const employee = await employeeService.getEmployeeById(Number(id));
    if (!employee) {
      throw new Error('Employee not found');
    }
    return employee;
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  .post('/', async ({ body }) => {
    try {
      Logger.debug(`Creating new employee: ${JSON.stringify(body)}`);
      const newEmployee = await employeeService.createEmployee(body);
      Logger.info(`Created employee: ${newEmployee.name} (ID: ${newEmployee.id})`);
      await logService.writeLog({
        action: 'CREATE',
        entity: 'employee',
        entityId: newEmployee.id,
        entityName: newEmployee.name,
        detail: `Employee "${newEmployee.name}" created`,
      });
      return newEmployee;
    } catch (error) {
      Logger.error('Error creating employee:', error);
      Logger.error('Employee data:', JSON.stringify(body, null, 2));
      throw error;
    }
  }, {
    body: t.Object({
      name: t.String()
    })
  })
  
  .put('/:id', async ({ params: { id }, body }) => {
    const employee = await employeeService.updateEmployee(Number(id), body);
    if (!employee) {
      throw new Error('Employee not found');
    }
    await logService.writeLog({
      action: 'UPDATE',
      entity: 'employee',
      entityId: employee.id,
      entityName: employee.name,
      detail: `Employee renamed to "${employee.name}"`,
    });
    return employee;
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      name: t.Optional(t.String())
    })
  })
  
  .delete('/:id', async ({ params: { id } }) => {
    const success = await employeeService.deleteEmployee(Number(id));
    if (!success) {
      throw new Error('Employee not found');
    }
    await logService.writeLog({
      action: 'DELETE',
      entity: 'employee',
      entityId: Number(id),
      detail: `Deleted employee ID ${id}`,
    });
    return { success: true };
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  .get('/search/:query', async ({ params: { query } }) => {
    return await employeeService.searchEmployees(query);
  }, {
    params: t.Object({
      query: t.String()
    })
  })
  
  .get('/stats/overview', async () => {
    return await employeeService.getEmployeeStats();
  });