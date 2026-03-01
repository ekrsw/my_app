-- DropForeignKey
ALTER TABLE "employee_external_accounts" DROP CONSTRAINT "employee_external_accounts_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_function_role_history" DROP CONSTRAINT "employee_function_role_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_function_roles" DROP CONSTRAINT "employee_function_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_group_history" DROP CONSTRAINT "employee_group_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_groups" DROP CONSTRAINT "employee_groups_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_position_history" DROP CONSTRAINT "employee_position_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_positions" DROP CONSTRAINT "employee_positions_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_change_history" DROP CONSTRAINT "shift_change_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_employee_id_fkey";

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_function_roles" ADD CONSTRAINT "employee_function_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_history" ADD CONSTRAINT "shift_change_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_group_history" ADD CONSTRAINT "employee_group_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_external_accounts" ADD CONSTRAINT "employee_external_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_function_role_history" ADD CONSTRAINT "employee_function_role_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_groups" ADD CONSTRAINT "employee_groups_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_position_history" ADD CONSTRAINT "employee_position_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
