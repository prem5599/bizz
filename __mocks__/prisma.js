// __mocks__/prisma.js
import { jest } from '@jest/globals'

// Clean mock database records - all empty arrays
const mockUsers = []
const mockOrganizations = []
const mockIntegrations = []
const mockDataPoints = []
const mockInsights = []
const mockOrganizationMembers = []

// Helper functions for mock operations
const findById = (array, id) => array.find(item => item.id === id) || null
const findByField = (array, field, value) => array.find(item => item[field] === value) || null
const findManyByField = (array, field, value) => array.filter(item => item[field] === value)

const applyWhere = (array, where) => {
  if (!where) return array
  
  return array.filter(item => {
    return Object.entries(where).every(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Handle nested conditions like { in: [...] }
        if (value.in) return value.in.includes(item[key])
        if (value.not) return item[key] !== value.not
        if (value.gte) return item[key] >= value.gte
        if (value.lte) return item[key] <= value.lte
      }
      return item[key] === value
    })
  })
}

const applyInclude = (item, include) => {
  if (!include) return item
  
  const result = { ...item }
  
  Object.entries(include).forEach(([key, shouldInclude]) => {
    if (shouldInclude) {
      switch (key) {
        case 'organization':
          result.organization = findById(mockOrganizations, item.organizationId)
          break
        case 'user':
          result.user = findById(mockUsers, item.userId)
          break
        case 'integration':
          result.integration = findById(mockIntegrations, item.integrationId)
          break
        default:
          result[key] = []
      }
    }
  })
  
  return result
}

// Mock Prisma client factory
const createMockPrismaClient = () => ({
  // User operations
  user: {
    findUnique: jest.fn(({ where, include }) => {
      const user = findById(mockUsers, where.id) || findByField(mockUsers, 'email', where.email)
      return Promise.resolve(user ? applyInclude(user, include) : null)
    }),
    
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockUsers, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newUser = {
        id: `user-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUsers.push(newUser)
      return Promise.resolve(applyInclude(newUser, include))
    }),
    
    update: jest.fn(({ where, data, include }) => {
      const index = mockUsers.findIndex(user => user.id === where.id)
      if (index === -1) throw new Error('User not found')
      
      mockUsers[index] = {
        ...mockUsers[index],
        ...data,
        updatedAt: new Date(),
      }
      return Promise.resolve(applyInclude(mockUsers[index], include))
    }),
    
    delete: jest.fn(({ where }) => {
      const index = mockUsers.findIndex(user => user.id === where.id)
      if (index === -1) throw new Error('User not found')
      
      const deleted = mockUsers.splice(index, 1)[0]
      return Promise.resolve(deleted)
    }),
  },

  // Organization operations
  organization: {
    findUnique: jest.fn(({ where, include }) => {
      const org = findById(mockOrganizations, where.id) || findByField(mockOrganizations, 'slug', where.slug)
      return Promise.resolve(org ? applyInclude(org, include) : null)
    }),
    
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockOrganizations, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newOrg = {
        id: `org-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockOrganizations.push(newOrg)
      return Promise.resolve(applyInclude(newOrg, include))
    }),
    
    update: jest.fn(({ where, data, include }) => {
      const index = mockOrganizations.findIndex(org => org.id === where.id)
      if (index === -1) throw new Error('Organization not found')
      
      mockOrganizations[index] = {
        ...mockOrganizations[index],
        ...data,
        updatedAt: new Date(),
      }
      return Promise.resolve(applyInclude(mockOrganizations[index], include))
    }),
    
    delete: jest.fn(({ where }) => {
      const index = mockOrganizations.findIndex(org => org.id === where.id)
      if (index === -1) throw new Error('Organization not found')
      
      const deleted = mockOrganizations.splice(index, 1)[0]
      return Promise.resolve(deleted)
    }),
  },

  // Integration operations
  integration: {
    findUnique: jest.fn(({ where, include }) => {
      const integration = findById(mockIntegrations, where.id)
      return Promise.resolve(integration ? applyInclude(integration, include) : null)
    }),
    
    findFirst: jest.fn(({ where, include }) => {
      const filtered = applyWhere(mockIntegrations, where)
      const integration = filtered[0] || null
      return Promise.resolve(integration ? applyInclude(integration, include) : null)
    }),
    
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockIntegrations, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newIntegration = {
        id: `integration-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockIntegrations.push(newIntegration)
      return Promise.resolve(applyInclude(newIntegration, include))
    }),
    
    update: jest.fn(({ where, data, include }) => {
      const index = mockIntegrations.findIndex(integration => integration.id === where.id)
      if (index === -1) throw new Error('Integration not found')
      
      mockIntegrations[index] = {
        ...mockIntegrations[index],
        ...data,
        updatedAt: new Date(),
      }
      return Promise.resolve(applyInclude(mockIntegrations[index], include))
    }),
    
    delete: jest.fn(({ where }) => {
      const index = mockIntegrations.findIndex(integration => integration.id === where.id)
      if (index === -1) throw new Error('Integration not found')
      
      const deleted = mockIntegrations.splice(index, 1)[0]
      return Promise.resolve(deleted)
    }),
  },

  // OrganizationMember operations
  organizationMember: {
    findFirst: jest.fn(({ where, include }) => {
      const filtered = applyWhere(mockOrganizationMembers, where)
      const member = filtered[0] || null
      return Promise.resolve(member ? applyInclude(member, include) : null)
    }),
    
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockOrganizationMembers, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newMember = {
        id: `member-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      }
      mockOrganizationMembers.push(newMember)
      return Promise.resolve(applyInclude(newMember, include))
    }),
    
    update: jest.fn(({ where, data, include }) => {
      const index = mockOrganizationMembers.findIndex(member => member.id === where.id)
      if (index === -1) throw new Error('Member not found')
      
      mockOrganizationMembers[index] = {
        ...mockOrganizationMembers[index],
        ...data,
      }
      return Promise.resolve(applyInclude(mockOrganizationMembers[index], include))
    }),
    
    delete: jest.fn(({ where }) => {
      const index = mockOrganizationMembers.findIndex(member => member.id === where.id)
      if (index === -1) throw new Error('Member not found')
      
      const deleted = mockOrganizationMembers.splice(index, 1)[0]
      return Promise.resolve(deleted)
    }),
  },

  // DataPoint operations
  dataPoint: {
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockDataPoints, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newDataPoint = {
        id: `dp-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      }
      mockDataPoints.push(newDataPoint)
      return Promise.resolve(applyInclude(newDataPoint, include))
    }),
    
    createMany: jest.fn(({ data, skipDuplicates }) => {
      const newDataPoints = data.map((item, index) => ({
        id: `dp-${Date.now()}-${index}`,
        ...item,
        createdAt: new Date(),
      }))
      
      if (skipDuplicates) {
        // Simple duplicate detection based on integrationId + metricType + dateRecorded
        const existingKeys = new Set(
          mockDataPoints.map(dp => `${dp.integrationId}-${dp.metricType}-${dp.dateRecorded.getTime()}`)
        )
        
        const uniqueDataPoints = newDataPoints.filter(dp => 
          !existingKeys.has(`${dp.integrationId}-${dp.metricType}-${dp.dateRecorded.getTime()}`)
        )
        
        mockDataPoints.push(...uniqueDataPoints)
        return Promise.resolve({ count: uniqueDataPoints.length })
      } else {
        mockDataPoints.push(...newDataPoints)
        return Promise.resolve({ count: newDataPoints.length })
      }
    }),
    
    deleteMany: jest.fn(({ where }) => {
      const filtered = applyWhere(mockDataPoints, where)
      const deletedCount = filtered.length
      
      filtered.forEach(dataPoint => {
        const index = mockDataPoints.findIndex(dp => dp.id === dataPoint.id)
        if (index !== -1) {
          mockDataPoints.splice(index, 1)
        }
      })
      
      return Promise.resolve({ count: deletedCount })
    }),
    
    updateMany: jest.fn(({ where, data }) => {
      const filtered = applyWhere(mockDataPoints, where)
      let updateCount = 0
      
      filtered.forEach(dataPoint => {
        const index = mockDataPoints.findIndex(dp => dp.id === dataPoint.id)
        if (index !== -1) {
          mockDataPoints[index] = {
            ...mockDataPoints[index],
            ...data,
          }
          updateCount++
        }
      })
      
      return Promise.resolve({ count: updateCount })
    }),
    
    count: jest.fn(({ where }) => {
      const filtered = applyWhere(mockDataPoints, where)
      return Promise.resolve(filtered.length)
    }),
    
    groupBy: jest.fn(({ by, where, _count, _sum, _avg, _min, _max }) => {
      const filtered = applyWhere(mockDataPoints, where)
      const groups = {}
      
      filtered.forEach(item => {
        const groupKey = by.map(field => item[field]).join('|')
        if (!groups[groupKey]) {
          const groupData = {}
          by.forEach(field => {
            groupData[field] = item[field]
          })
          groups[groupKey] = groupData
        }
      })
      
      return Promise.resolve(Object.values(groups))
    }),
  },

  // Insight operations
  insight: {
    findMany: jest.fn(({ where, include, orderBy, skip, take }) => {
      let filtered = applyWhere(mockInsights, where)
      
      if (orderBy) {
        const [field, direction] = Object.entries(orderBy)[0]
        filtered.sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          if (direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        })
      }
      
      if (skip) filtered = filtered.slice(skip)
      if (take) filtered = filtered.slice(0, take)
      
      const result = filtered.map(item => applyInclude(item, include))
      return Promise.resolve(result)
    }),
    
    create: jest.fn(({ data, include }) => {
      const newInsight = {
        id: `insight-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      }
      mockInsights.push(newInsight)
      return Promise.resolve(applyInclude(newInsight, include))
    }),
    
    createMany: jest.fn(({ data }) => {
      const newInsights = data.map((item, index) => ({
        id: `insight-${Date.now()}-${index}`,
        ...item,
        createdAt: new Date(),
      }))
      
      mockInsights.push(...newInsights)
      return Promise.resolve({ count: newInsights.length })
    }),
    
    update: jest.fn(({ where, data, include }) => {
      const index = mockInsights.findIndex(insight => insight.id === where.id)
      if (index === -1) throw new Error('Insight not found')
      
      mockInsights[index] = {
        ...mockInsights[index],
        ...data,
      }
      return Promise.resolve(applyInclude(mockInsights[index], include))
    }),
    
    delete: jest.fn(({ where }) => {
      const index = mockInsights.findIndex(insight => insight.id === where.id)
      if (index === -1) throw new Error('Insight not found')
      
      const deleted = mockInsights.splice(index, 1)[0]
      return Promise.resolve(deleted)
    }),
    
    deleteMany: jest.fn(({ where }) => {
      const filtered = applyWhere(mockInsights, where)
      const deletedCount = filtered.length
      
      filtered.forEach(insight => {
        const index = mockInsights.findIndex(i => i.id === insight.id)
        if (index !== -1) {
          mockInsights.splice(index, 1)
        }
      })
      
      return Promise.resolve({ count: deletedCount })
    }),
  },

  // Transaction support
  $transaction: jest.fn((queries) => {
    // Simple transaction mock - just execute all queries
    if (Array.isArray(queries)) {
      return Promise.all(queries)
    } else if (typeof queries === 'function') {
      // Interactive transaction
      const tx = createMockPrismaClient()
      return Promise.resolve(queries(tx))
    }
    return Promise.resolve([])
  }),

  // Connection and utility methods
  $connect: jest.fn(() => Promise.resolve()),
  $disconnect: jest.fn(() => Promise.resolve()),
  $executeRaw: jest.fn(() => Promise.resolve(1)),
  $queryRaw: jest.fn(() => Promise.resolve([])),
  
  // Reset function for tests
  $reset: jest.fn(() => {
    // Reset all mock data to initial empty state
    mockUsers.length = 0
    mockOrganizations.length = 0
    mockIntegrations.length = 0
    mockDataPoints.length = 0
    mockInsights.length = 0
    mockOrganizationMembers.length = 0
    
    return Promise.resolve()
  }),
})

// Create and export the mock client
export const prisma = createMockPrismaClient()

// Export mock data for test access
export const mockData = {
  users: mockUsers,
  organizations: mockOrganizations,
  integrations: mockIntegrations,
  dataPoints: mockDataPoints,
  insights: mockInsights,
  organizationMembers: mockOrganizationMembers,
}

// Export helper functions
export const mockHelpers = {
  findById,
  findByField,
  findManyByField,
  applyWhere,
  applyInclude,
}