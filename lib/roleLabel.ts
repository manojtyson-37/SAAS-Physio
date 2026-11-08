export function roleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ONBOARDING":
      return "Onboarding team";
    case "CLINIC_ADMIN":
      return "Clinic Admin";
    case "DOCTOR":
      return "Doctor";
    case "STAFF":
      return "Staff";
    default:
      return role;
  }
}
