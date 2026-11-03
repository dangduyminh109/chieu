import { z } from 'zod';
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9_.-]{2,31}$/,
    'Tên đăng nhập cần 3 đến 32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.',
  );
