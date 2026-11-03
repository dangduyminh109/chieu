export function mutationMessage(error: { code?: string; message?: string } | null) {
  if (!error) return 'Đã lưu thay đổi.';
  if (error.code === '23505')
    return 'Thông tin đã tồn tại. Vui lòng kiểm tra mã hoặc ngày áp dụng.';
  if (error.code === '23503') return 'Dữ liệu đã được sử dụng. Hãy ngừng sử dụng thay vì xóa.';
  const messages: Record<string, string> = {
    INVALID_PAYMENT_QR: 'Ảnh QR chưa tải xong hoặc không hợp lệ. Vui lòng chọn lại ảnh.',
    DEBT_CONTACT_REQUIRED: 'Giao dịch còn nợ cần chọn khách hàng hoặc nhà cung cấp.',
    INVALID_MAT_IMAGE: 'Ảnh chưa tải xong hoặc không hợp lệ. Vui lòng chọn lại ảnh.',
    WORK_ALREADY_PAID_OR_LOCKED: 'Công đã được thanh toán hoặc khóa, không thể sửa số lượng.',
    QUANTITY_ONLY:
      'Chỉ sửa số lượng của bản ghi này; ngày, loại chiếu và công đoạn được giữ nguyên.',
    VERSION_CONFLICT: 'Bản ghi đã thay đổi. Hãy tải lại dữ liệu trước khi tiếp tục.',
    INVALID_TRANSITION: 'Trạng thái công không cho phép thao tác này.',
    IMMUTABLE_WORK: 'Công đã ghi nhận hoặc khóa không thể thay đổi số tiền.',
    OVERPAYMENT: 'Số tiền vượt quá số dư còn phải thanh toán.',
    INVALID_ALLOCATIONS: 'Phân bổ lương chưa hợp lệ hoặc công chưa được ghi nhận.',
    INSUFFICIENT_STOCK: 'Không đủ tồn kho cho giao dịch vào ngày đã chọn.',
    INSUFFICIENT_STAGE_STOCK: 'Không đủ chiếu ở bước này. Kiểm tra số lượng và ngày cập nhật.',
    STOCK_MAT_REQUIRED:
      'Chọn loại chiếu để tự cập nhật kho. Đơn giá buộc, cắt, may vẫn dùng chung.',
    WORK_STOCK_LINKED: 'Công đã cập nhật kho, không thể xóa trực tiếp.',
    MATS_NOT_READY_FOR_SALE:
      'Không đủ chiếu đã cắt hoặc đã may để bán. Chiếu chưa cắt chưa được bán.',
    OVERRIDE_REASON_REQUIRED: 'Giá khác bảng giá cần có lý do ít nhất 5 ký tự.',
    REFERENCE_REQUIRED: 'Cần mã lô hoàn thành để tránh nhập kho trùng.',
    UNIT_IN_USE: 'Nguyên liệu đã phát sinh giao dịch, không thể đổi đơn vị.',
    INVALID_BUNDLES: 'Kiểm tra trọng lượng, giá tiền và số bó lát.',
    INVALID_PAYMENT: 'Ngày thanh toán hoặc số tiền chưa hợp lệ.',
    REASON_REQUIRED: 'Nhập lý do ít nhất 5 ký tự.',
    FUTURE_WORK_DATE: 'Chỉ ghi công cho hôm nay hoặc ngày trong quá khứ.',
    INVALID_DATE: 'Ngày không hợp lệ hoặc nằm trong tương lai.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    RATE_NOT_FOUND: 'Chưa có đơn giá cho ngày và công đoạn này.',
    RATE_CHANGED: 'Đơn giá vừa thay đổi. Hãy tải lại trang và kiểm tra trước khi gửi.',
    SKILL_REQUIRED: 'Bạn chưa được phân công công đoạn này.',
    INACTIVE_CATALOG: 'Loại chiếu hoặc công đoạn đã ngừng sử dụng.',
    IDEMPOTENCY_CONFLICT: 'Lần gửi trước đã được lưu với nội dung khác. Hãy tải lại trang.',
    SELF_PERMISSION_CHANGE: 'Không thể tự thay đổi quyền của mình.',
    INVALID_ZERO_POLICY: 'Công bằng 0 chỉ áp dụng cho tài khoản vừa là chủ cơ sở vừa là thợ.',
  };
  return messages[error.message ?? ''] ?? 'Không thể lưu. Vui lòng kiểm tra thông tin và thử lại.';
}
