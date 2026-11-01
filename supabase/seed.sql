-- Catalog examples only. No fictional transactions, wages, or revenue.
insert into public.production_stages(code,name,sort_order) values
 ('WEAVING','Dệt chiếu',1),('CUTTING','Cắt chiếu',2),('SEWING','May chiếu',3),('TYING','Buộc chiếu',4),('OTHER','Công việc khác',5)
on conflict(code) do nothing;
insert into public.expense_categories(code,name) values
 ('REPAIR','Sửa máy'),('MAINTENANCE','Bảo dưỡng máy'),('TRANSPORT','Vận chuyển'),('UTILITIES','Điện nước'),('OTHER','Chi phí khác') on conflict(code) do nothing;
insert into public.mat_types(code,name,dimensions,description) values
 ('CHIEU_16','Chiếu lát 1,6 m','1,6 × 2 m','Danh mục minh họa. Hãy chỉnh theo sản phẩm của xưởng.'),
 ('CHIEU_18','Chiếu lát 1,8 m','1,8 × 2 m','Danh mục minh họa. Chưa thiết lập đơn giá.') on conflict(code) do nothing;
