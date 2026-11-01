export function mutationMessage(error: { code?: string; message?: string } | null) {
  if (!error) return 'Đã lưu thay đổi.';
  if (error.code === '23505')
    return 'Thông tin đã tồn tại. Vui lòng kiểm tra mã hoặc ngày áp dụng.';
  if (error.code === '23503') return 'Dữ liệu đã được sử dụng. Hãy ngừng sử dụng thay vì xóa.';
  const messages: Record<string, string> = {
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    RATE_NOT_FOUND: 'Chưa có đơn giá cho ngày và công đoạn này.',
    RATE_CHANGED: 'Đơn giá vừa thay đổi. Hãy tải lại trang và kiểm tra trước khi gửi.',
    SKILL_REQUIRED: 'Bạn chưa được phân công công đoạn này.',
    INACTIVE_CATALOG: 'Loại chiếu hoặc công đoạn đã ngừng sử dụng.',
    IDEMPOTENCY_CONFLICT: 'Lần gửi trước đã được lưu với nội dung khác. Hãy tải lại trang.',
    SELF_PERMISSION_CHANGE: 'Không thể tự thay đổi quyền của mình.',
    INVALID_ZERO_POLICY: 'Công bằng 0 chỉ áp dụng cho tài khoản vừa là chủ xưởng vừa là thợ.',
  };
  return messages[error.message ?? ''] ?? 'Không thể lưu. Vui lòng kiểm tra thông tin và thử lại.';
}
