export interface Role {
  id: string
  title: string
  department: string
  location: string
  jobUrl: string
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
