export interface Role {
  id: string
  title: string
  department: string
  location: string
  applyUrl: string
}

export interface Department {
  name: string
  key: string
  roles: Role[]
}

export interface RolesSnapshot {
  fetchedAt: string
  departments: Department[]
}
