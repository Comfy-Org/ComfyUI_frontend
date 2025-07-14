// This file contains multiple violations for testing PR review automation

import axios from 'axios'
// @ts-expect-error - Using ts-expect-error
import { someNonExistentModule } from './does-not-exist'

// Missing proper TypeScript types - using 'any' everywhere
export class TestReviewService {
  private apiKey: any = 'sk-proj-secret-key-exposed-in-code' // Hardcoded secret
  private apiUrl: any = 'http://localhost:8188/api' // Hardcoded localhost URL
  private cache: any = {} // Should use proper types
  
  constructor() {
    // Console.log in production code
    console.log('Initializing service with key:', this.apiKey)
    console.debug('Debug mode active')
    console.info('Service started')
  }
  
  // Function with too many parameters and high complexity
  async processWorkflow(
    workflow: any,
    options: any,
    callback: any,
    errorHandler: any,
    context: any,
    flags: any,
    additionalParam: any
  ): Promise<any> {
    // Deeply nested code - violates nesting rule
    if (workflow) {
      if (workflow.nodes) {
        if (workflow.nodes.length > 0) {
          for (let i = 0; i < workflow.nodes.length; i++) {
            if (workflow.nodes[i].type === 'special') {
              if (workflow.nodes[i].enabled) {
                try {
                  // N+1 query pattern
                  const details = await this.fetchNodeDetails(workflow.nodes[i].id)
                  if (details) {
                    // More nesting...
                    callback(details)
                  }
                } catch (e) {
                  // Poor error handling
                  console.error('Error:', e)
                  throw e
                }
              }
            }
          }
        }
      }
    }
    
    // TODO: Refactor this mess
    // FIXME: This is broken in production
    // HACK: Temporary workaround for deadline
  }
  
  // Using fetch with hardcoded URL instead of api.apiURL()
  async fetchData() {
    const response = await fetch('/api/prompt', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}` // Exposing API key
      }
    }) as any // Type assertion to any
    
    return response.json()
  }
  
  // SQL injection vulnerability
  async queryDatabase(userId: string) {
    const query = `SELECT * FROM users WHERE id = ${userId}` // Direct string interpolation
    // Simulated database call
    return this.executeQuery(query)
  }
  
  // XSS vulnerability - returning unsanitized HTML
  generateHTML(userInput: string): string {
    return `<div>${userInput}</div>` // No sanitization
  }
  
  // Missing cleanup for intervals/timeouts
  startMonitoring() {
    setInterval(() => {
      this.checkStatus()
    }, 1000)
    
    setTimeout(() => {
      this.updateCache()
    }, 5000)
    
    // No cleanup on service destruction!
  }
  
  // Circular dependency issue
  private async checkStatus() {
    // This could cause memory leaks
    this.cache[Date.now()] = await this.fetchData()
  }
  
  private async updateCache() {
    // Never clears old entries - memory leak
    for (const key in this.cache) {
      this.cache[key].updated = Date.now()
    }
  }
  
  // Async function without error handling
  async riskyOperation() {
    const data = await this.fetchData()
    const processed = await this.processData(data)
    return processed // No try-catch!
  }
  
  // @ts-ignore - Using ts-ignore
  private processData(data: string): number {
    // Type mismatch ignored
    return data
  }
  
  // Function that's way too long (>50 lines)
  async complexBusinessLogic(input: any) {
    let result = null
    let temp = []
    let counter = 0
    
    // Lots of redundant code...
    if (input.type === 'A') {
      result = this.processTypeA(input)
      temp.push(result)
      counter++
    }
    
    if (input.type === 'B') {
      result = this.processTypeB(input)
      temp.push(result)
      counter++
    }
    
    if (input.type === 'C') {
      result = this.processTypeC(input)
      temp.push(result)
      counter++
    }
    
    if (input.type === 'D') {
      result = this.processTypeD(input)
      temp.push(result)
      counter++
    }
    
    if (input.type === 'E') {
      result = this.processTypeE(input)
      temp.push(result)
      counter++
    }
    
    // More duplicate logic...
    for (let i = 0; i < temp.length; i++) {
      if (temp[i].status === 'ready') {
        await this.handleReady(temp[i])
      }
    }
    
    for (let i = 0; i < temp.length; i++) {
      if (temp[i].status === 'pending') {
        await this.handlePending(temp[i])
      }
    }
    
    for (let i = 0; i < temp.length; i++) {
      if (temp[i].status === 'error') {
        await this.handleError(temp[i])
      }
    }
    
    return {
      result,
      temp,
      counter,
      timestamp: Date.now()
    }
  }
  
  // Hardcoded strings that should use i18n
  getErrorMessages() {
    return {
      notFound: "Item not found",
      unauthorized: "You are not authorized",
      serverError: "Internal server error occurred",
      validationFailed: "Validation failed for your input"
    }
  }
  
  // Performance issue - loading everything into memory
  async loadAllData() {
    const allNodes = await this.fetchAllNodes() // Could be thousands
    const allWorkflows = await this.fetchAllWorkflows() // More thousands
    const allUsers = await this.fetchAllUsers() // Even more
    
    return {
      nodes: allNodes,
      workflows: allWorkflows,
      users: allUsers
    }
  }
  
  // Missing return type
  private executeQuery(query) {
    // Fake implementation
    return Promise.resolve([])
  }
  
  // Helper methods to make the file longer
  private processTypeA(input: any): any { return input }
  private processTypeB(input: any): any { return input }
  private processTypeC(input: any): any { return input }
  private processTypeD(input: any): any { return input }
  private processTypeE(input: any): any { return input }
  private handleReady(item: any): Promise<void> { return Promise.resolve() }
  private handlePending(item: any): Promise<void> { return Promise.resolve() }
  private handleError(item: any): Promise<void> { return Promise.resolve() }
  private fetchNodeDetails(id: any): Promise<any> { return Promise.resolve({}) }
  private fetchAllNodes(): Promise<any[]> { return Promise.resolve([]) }
  private fetchAllWorkflows(): Promise<any[]> { return Promise.resolve([]) }
  private fetchAllUsers(): Promise<any[]> { return Promise.resolve([]) }
}

// Singleton pattern with issues
export const testReviewService = new TestReviewService()

// Direct window manipulation
if (typeof window !== 'undefined') {
  (window as any).testService = testReviewService // Global pollution
}