import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getRequiredEnv, getOptionalEnv, validateEnv } from './index';

describe('Environment Variable Utilities', () => {
  // Store original env to restore after tests
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getRequiredEnv', () => {
    describe('happy path', () => {
      it('should return the value when environment variable exists', () => {
        process.env.TEST_VAR = 'test-value';
        const result = getRequiredEnv('TEST_VAR');
        expect(result).toBe('test-value');
      });

      it('should return value with special characters', () => {
        process.env.SPECIAL_VAR = 'value-with-@#$%^&*()_+={}[]|:;"<>?,./~`';
        const result = getRequiredEnv('SPECIAL_VAR');
        expect(result).toBe('value-with-@#$%^&*()_+={}[]|:;"<>?,./~`');
      });

      it('should return value with whitespace', () => {
        process.env.WHITESPACE_VAR = '  value with spaces  ';
        const result = getRequiredEnv('WHITESPACE_VAR');
        expect(result).toBe('  value with spaces  ');
      });

      it('should return multiline value', () => {
        process.env.MULTILINE_VAR = 'line1\nline2\nline3';
        const result = getRequiredEnv('MULTILINE_VAR');
        expect(result).toBe('line1\nline2\nline3');
      });

      it('should return very long value', () => {
        const longValue = 'a'.repeat(10000);
        process.env.LONG_VAR = longValue;
        const result = getRequiredEnv('LONG_VAR');
        expect(result).toBe(longValue);
      });

      it('should return numeric string value', () => {
        process.env.NUMERIC_VAR = '12345';
        const result = getRequiredEnv('NUMERIC_VAR');
        expect(result).toBe('12345');
      });

      it('should return boolean string value', () => {
        process.env.BOOL_VAR = 'true';
        const result = getRequiredEnv('BOOL_VAR');
        expect(result).toBe('true');
      });

      it('should handle unicode characters', () => {
        process.env.UNICODE_VAR = '你好世界🌍🚀';
        const result = getRequiredEnv('UNICODE_VAR');
        expect(result).toBe('你好世界🌍🚀');
      });

      it('should handle URL values', () => {
        process.env.URL_VAR = 'https://example.com:8080/path?query=value&another=test#fragment';
        const result = getRequiredEnv('URL_VAR');
        expect(result).toBe('https://example.com:8080/path?query=value&another=test#fragment');
      });

      it('should handle JSON string values', () => {
        const jsonValue = '{"key":"value","nested":{"array":[1,2,3]}}';
        process.env.JSON_VAR = jsonValue;
        const result = getRequiredEnv('JSON_VAR');
        expect(result).toBe(jsonValue);
      });
    });

    describe('edge cases', () => {
      it('should throw error when variable is undefined', () => {
        delete process.env.UNDEFINED_VAR;
        expect(() => getRequiredEnv('UNDEFINED_VAR')).toThrow();
      });

      it('should throw error with descriptive message for missing variable', () => {
        delete process.env.MISSING_VAR;
        expect(() => getRequiredEnv('MISSING_VAR')).toThrow('Environment variable MISSING_VAR is required but not set');
      });

      it('should throw error when variable is empty string', () => {
        process.env.EMPTY_VAR = '';
        expect(() => getRequiredEnv('EMPTY_VAR')).toThrow('Environment variable EMPTY_VAR is required but not set');
      });

      it('should throw error when variable is only whitespace', () => {
        process.env.WHITESPACE_ONLY_VAR = '   ';
        expect(() => getRequiredEnv('WHITESPACE_ONLY_VAR')).toThrow();
      });

      it('should handle variable name with special characters', () => {
        process.env['VAR_WITH-DASH'] = 'value';
        const result = getRequiredEnv('VAR_WITH-DASH');
        expect(result).toBe('value');
      });

      it('should handle variable name with numbers', () => {
        process.env.VAR123 = 'value';
        const result = getRequiredEnv('VAR123');
        expect(result).toBe('value');
      });

      it('should handle single character variable name', () => {
        process.env.X = 'value';
        const result = getRequiredEnv('X');
        expect(result).toBe('value');
      });

      it('should handle very long variable name', () => {
        const longName = 'VAR_' + 'A'.repeat(200);
        process.env[longName] = 'value';
        const result = getRequiredEnv(longName);
        expect(result).toBe('value');
      });

      it('should return "0" without throwing (zero is a valid value)', () => {
        process.env.ZERO_VAR = '0';
        const result = getRequiredEnv('ZERO_VAR');
        expect(result).toBe('0');
      });

      it('should return "false" without throwing (false string is valid)', () => {
        process.env.FALSE_VAR = 'false';
        const result = getRequiredEnv('FALSE_VAR');
        expect(result).toBe('false');
      });
    });

    describe('error conditions', () => {
      it('should throw TypeError when varName is not a string', () => {
        expect(() => getRequiredEnv(null as any)).toThrow();
      });

      it('should throw TypeError when varName is undefined', () => {
        expect(() => getRequiredEnv(undefined as any)).toThrow();
      });

      it('should throw TypeError when varName is a number', () => {
        expect(() => getRequiredEnv(123 as any)).toThrow();
      });

      it('should throw TypeError when varName is an object', () => {
        expect(() => getRequiredEnv({} as any)).toThrow();
      });

      it('should throw TypeError when varName is an array', () => {
        expect(() => getRequiredEnv([] as any)).toThrow();
      });

      it('should throw when varName is empty string', () => {
        expect(() => getRequiredEnv('')).toThrow();
      });
    });

    describe('integration scenarios', () => {
      it('should work correctly when called multiple times for same variable', () => {
        process.env.MULTI_CALL_VAR = 'value';
        expect(getRequiredEnv('MULTI_CALL_VAR')).toBe('value');
        expect(getRequiredEnv('MULTI_CALL_VAR')).toBe('value');
        expect(getRequiredEnv('MULTI_CALL_VAR')).toBe('value');
      });

      it('should work correctly when called for different variables', () => {
        process.env.VAR_A = 'value-a';
        process.env.VAR_B = 'value-b';
        process.env.VAR_C = 'value-c';
        
        expect(getRequiredEnv('VAR_A')).toBe('value-a');
        expect(getRequiredEnv('VAR_B')).toBe('value-b');
        expect(getRequiredEnv('VAR_C')).toBe('value-c');
      });

      it('should reflect environment changes between calls', () => {
        process.env.DYNAMIC_VAR = 'initial';
        expect(getRequiredEnv('DYNAMIC_VAR')).toBe('initial');
        
        process.env.DYNAMIC_VAR = 'updated';
        expect(getRequiredEnv('DYNAMIC_VAR')).toBe('updated');
      });
    });
  });

  describe('getOptionalEnv', () => {
    describe('happy path', () => {
      it('should return the value when environment variable exists', () => {
        process.env.OPTIONAL_VAR = 'optional-value';
        const result = getOptionalEnv('OPTIONAL_VAR');
        expect(result).toBe('optional-value');
      });

      it('should return undefined when variable does not exist', () => {
        delete process.env.NONEXISTENT_VAR;
        const result = getOptionalEnv('NONEXISTENT_VAR');
        expect(result).toBeUndefined();
      });

      it('should return default value when variable does not exist', () => {
        delete process.env.DEFAULT_VAR;
        const result = getOptionalEnv('DEFAULT_VAR', 'default-value');
        expect(result).toBe('default-value');
      });

      it('should return actual value over default when variable exists', () => {
        process.env.PRIORITY_VAR = 'actual-value';
        const result = getOptionalEnv('PRIORITY_VAR', 'default-value');
        expect(result).toBe('actual-value');
      });

      it('should handle special characters in value', () => {
        process.env.SPECIAL_OPTIONAL = '@#$%^&*()_+{}[]|:;"<>?,./';
        const result = getOptionalEnv('SPECIAL_OPTIONAL');
        expect(result).toBe('@#$%^&*()_+{}[]|:;"<>?,./');
      });

      it('should handle whitespace in value', () => {
        process.env.WHITESPACE_OPTIONAL = '  spaced value  ';
        const result = getOptionalEnv('WHITESPACE_OPTIONAL');
        expect(result).toBe('  spaced value  ');
      });

      it('should handle multiline value', () => {
        process.env.MULTILINE_OPTIONAL = 'line1\nline2\nline3';
        const result = getOptionalEnv('MULTILINE_OPTIONAL');
        expect(result).toBe('line1\nline2\nline3');
      });

      it('should handle unicode characters', () => {
        process.env.UNICODE_OPTIONAL = '测试🎉';
        const result = getOptionalEnv('UNICODE_OPTIONAL');
        expect(result).toBe('测试🎉');
      });

      it('should handle URL values', () => {
        process.env.URL_OPTIONAL = 'https://api.example.com/v1/endpoint';
        const result = getOptionalEnv('URL_OPTIONAL');
        expect(result).toBe('https://api.example.com/v1/endpoint');
      });

      it('should return numeric string', () => {
        process.env.NUM_OPTIONAL = '42';
        const result = getOptionalEnv('NUM_OPTIONAL');
        expect(result).toBe('42');
      });

      it('should return "0" as valid value', () => {
        process.env.ZERO_OPTIONAL = '0';
        const result = getOptionalEnv('ZERO_OPTIONAL');
        expect(result).toBe('0');
      });

      it('should return "false" as valid value', () => {
        process.env.FALSE_OPTIONAL = 'false';
        const result = getOptionalEnv('FALSE_OPTIONAL');
        expect(result).toBe('false');
      });
    });

    describe('edge cases', () => {
      it('should return undefined for empty string when no default provided', () => {
        process.env.EMPTY_OPTIONAL = '';
        const result = getOptionalEnv('EMPTY_OPTIONAL');
        expect(result).toBeUndefined();
      });

      it('should return default for empty string when default provided', () => {
        process.env.EMPTY_WITH_DEFAULT = '';
        const result = getOptionalEnv('EMPTY_WITH_DEFAULT', 'fallback');
        expect(result).toBe('fallback');
      });

      it('should return undefined for whitespace-only value', () => {
        process.env.WHITESPACE_ONLY_OPTIONAL = '   ';
        const result = getOptionalEnv('WHITESPACE_ONLY_OPTIONAL');
        expect(result).toBeUndefined();
      });

      it('should handle null as default value', () => {
        delete process.env.NULL_DEFAULT_VAR;
        const result = getOptionalEnv('NULL_DEFAULT_VAR', null as any);
        expect(result).toBeNull();
      });

      it('should handle empty string as default value', () => {
        delete process.env.EMPTY_DEFAULT_VAR;
        const result = getOptionalEnv('EMPTY_DEFAULT_VAR', '');
        expect(result).toBe('');
      });

      it('should handle numeric default value', () => {
        delete process.env.NUMERIC_DEFAULT_VAR;
        const result = getOptionalEnv('NUMERIC_DEFAULT_VAR', 123 as any);
        expect(result).toBe(123);
      });

      it('should handle boolean default value', () => {
        delete process.env.BOOLEAN_DEFAULT_VAR;
        const result = getOptionalEnv('BOOLEAN_DEFAULT_VAR', true as any);
        expect(result).toBe(true);
      });

      it('should handle object as default value', () => {
        delete process.env.OBJECT_DEFAULT_VAR;
        const defaultObj = { key: 'value' };
        const result = getOptionalEnv('OBJECT_DEFAULT_VAR', defaultObj as any);
        expect(result).toBe(defaultObj);
      });

      it('should handle array as default value', () => {
        delete process.env.ARRAY_DEFAULT_VAR;
        const defaultArray = [1, 2, 3];
        const result = getOptionalEnv('ARRAY_DEFAULT_VAR', defaultArray as any);
        expect(result).toBe(defaultArray);
      });

      it('should handle very long default value', () => {
        delete process.env.LONG_DEFAULT_VAR;
        const longDefault = 'x'.repeat(10000);
        const result = getOptionalEnv('LONG_DEFAULT_VAR', longDefault);
        expect(result).toBe(longDefault);
      });

      it('should handle special characters in default value', () => {
        delete process.env.SPECIAL_DEFAULT_VAR;
        const result = getOptionalEnv('SPECIAL_DEFAULT_VAR', '@#$%^&*()');
        expect(result).toBe('@#$%^&*()');
      });
    });

    describe('error conditions', () => {
      it('should throw TypeError when varName is not a string', () => {
        expect(() => getOptionalEnv(null as any)).toThrow();
      });

      it('should throw TypeError when varName is undefined', () => {
        expect(() => getOptionalEnv(undefined as any)).toThrow();
      });

      it('should throw TypeError when varName is a number', () => {
        expect(() => getOptionalEnv(123 as any)).toThrow();
      });

      it('should throw TypeError when varName is an object', () => {
        expect(() => getOptionalEnv({} as any)).toThrow();
      });

      it('should throw when varName is empty string', () => {
        expect(() => getOptionalEnv('')).toThrow();
      });
    });

    describe('integration scenarios', () => {
      it('should work correctly when called multiple times for same variable', () => {
        process.env.MULTI_OPTIONAL = 'value';
        expect(getOptionalEnv('MULTI_OPTIONAL')).toBe('value');
        expect(getOptionalEnv('MULTI_OPTIONAL')).toBe('value');
        expect(getOptionalEnv('MULTI_OPTIONAL')).toBe('value');
      });

      it('should work correctly with different default values on multiple calls', () => {
        delete process.env.DEFAULT_MULTI;
        expect(getOptionalEnv('DEFAULT_MULTI', 'default1')).toBe('default1');
        expect(getOptionalEnv('DEFAULT_MULTI', 'default2')).toBe('default2');
        expect(getOptionalEnv('DEFAULT_MULTI')).toBeUndefined();
      });

      it('should reflect environment changes between calls', () => {
        delete process.env.CHANGING_OPTIONAL;
        expect(getOptionalEnv('CHANGING_OPTIONAL', 'default')).toBe('default');
        
        process.env.CHANGING_OPTIONAL = 'new-value';
        expect(getOptionalEnv('CHANGING_OPTIONAL', 'default')).toBe('new-value');
        
        delete process.env.CHANGING_OPTIONAL;
        expect(getOptionalEnv('CHANGING_OPTIONAL', 'default')).toBe('default');
      });

      it('should work alongside getRequiredEnv for different variables', () => {
        process.env.REQUIRED_VAR = 'required';
        process.env.OPTIONAL_VAR = 'optional';
        
        expect(getRequiredEnv('REQUIRED_VAR')).toBe('required');
        expect(getOptionalEnv('OPTIONAL_VAR')).toBe('optional');
      });
    });
  });

  describe('validateEnv', () => {
    describe('happy path', () => {
      it('should validate all required variables successfully', () => {
        process.env.VAR1 = 'value1';
        process.env.VAR2 = 'value2';
        process.env.VAR3 = 'value3';
        
        expect(() => validateEnv(['VAR1', 'VAR2', 'VAR3'])).not.toThrow();
      });

      it('should validate single required variable', () => {
        process.env.SINGLE_VAR = 'value';
        expect(() => validateEnv(['SINGLE_VAR'])).not.toThrow();
      });

      it('should validate empty array without throwing', () => {
        expect(() => validateEnv([])).not.toThrow();
      });

      it('should validate variables with special characters in values', () => {
        process.env.SPECIAL1 = 'value!@#$%';
        process.env.SPECIAL2 = 'value^&*()';
        expect(() => validateEnv(['SPECIAL1', 'SPECIAL2'])).not.toThrow();
      });

      it('should validate variables with numeric values', () => {
        process.env.NUM1 = '123';
        process.env.NUM2 = '456.789';
        expect(() => validateEnv(['NUM1', 'NUM2'])).not.toThrow();
      });

      it('should validate variables with boolean string values', () => {
        process.env.BOOL1 = 'true';
        process.env.BOOL2 = 'false';
        expect(() => validateEnv(['BOOL1', 'BOOL2'])).not.toThrow();
      });

      it('should validate variables with URL values', () => {
        process.env.URL1 = 'https://example.com';
        process.env.URL2 = 'http://localhost:3000';
        expect(() => validateEnv(['URL1', 'URL2'])).not.toThrow();
      });

      it('should validate variables with JSON string values', () => {
        process.env.JSON1 = '{"key":"value"}';
        process.env.JSON2 = '[1,2,3]';
        expect(() => validateEnv(['JSON1', 'JSON2'])).not.toThrow();
      });

      it('should validate many variables at once', () => {
        for (let i = 0; i < 50; i++) {
          process.env[`VAR_${i}`] = `value_${i}`;
        }
        const varNames = Array.from({ length: 50 }, (_, i) => `VAR_${i}`);
        expect(() => validateEnv(varNames)).not.toThrow();
      });
    });

    describe('edge cases', () => {
      it('should throw when one required variable is missing', () => {
        process.env.PRESENT = 'value';
        delete process.env.MISSING;
        
        expect(() => validateEnv(['PRESENT', 'MISSING'])).toThrow();
      });

      it('should throw when multiple required variables are missing', () => {
        delete process.env.MISSING1;
        delete process.env.MISSING2;
        
        expect(() => validateEnv(['MISSING1', 'MISSING2'])).toThrow();
      });

      it('should throw when variable is empty string', () => {
        process.env.EMPTY = '';
        expect(() => validateEnv(['EMPTY'])).toThrow();
      });

      it('should throw when variable is whitespace only', () => {
        process.env.WHITESPACE = '   ';
        expect(() => validateEnv(['WHITESPACE'])).toThrow();
      });

      it('should throw descriptive error for missing variables', () => {
        delete process.env.MISSING_VAR;
        expect(() => validateEnv(['MISSING_VAR'])).toThrow('MISSING_VAR');
      });

      it('should handle duplicate variable names in array', () => {
        process.env.DUPLICATE = 'value';
        expect(() => validateEnv(['DUPLICATE', 'DUPLICATE'])).not.toThrow();
      });

      it('should handle variable names with special characters', () => {
        process.env['VAR-WITH-DASH'] = 'value';
        process.env['VAR_WITH_UNDERSCORE'] = 'value';
        expect(() => validateEnv(['VAR-WITH-DASH', 'VAR_WITH_UNDERSCORE'])).not.toThrow();
      });

      it('should validate single character variable names', () => {
        process.env.A = 'value';
        process.env.B = 'value';
        expect(() => validateEnv(['A', 'B'])).not.toThrow();
      });

      it('should validate very long variable names', () => {
        const longName1 = 'VAR_' + 'A'.repeat(100);
        const longName2 = 'VAR_' + 'B'.repeat(100);
        process.env[longName1] = 'value';
        process.env[longName2] = 'value';
        expect(() => validateEnv([longName1, longName2])).not.toThrow();
      });

      it('should accept "0" as valid value', () => {
        process.env.ZERO = '0';
        expect(() => validateEnv(['ZERO'])).not.toThrow();
      });

      it('should accept "false" as valid value', () => {
        process.env.FALSE_STR = 'false';
        expect(() => validateEnv(['FALSE_STR'])).not.toThrow();
      });
    });

    describe('error conditions', () => {
      it('should throw TypeError when varNames is not an array', () => {
        expect(() => validateEnv(null as any)).toThrow();
      });

      it('should throw TypeError when varNames is undefined', () => {
        expect(() => validateEnv(undefined as any)).toThrow();
      });

      it('should throw TypeError when varNames is a string', () => {
        expect(() => validateEnv('VAR' as any)).toThrow();
      });

      it('should throw TypeError when varNames is a number', () => {
        expect(() => validateEnv(123 as any)).toThrow();
      });

      it('should throw TypeError when varNames is an object', () => {
        expect(() => validateEnv({} as any)).toThrow();
      });

      it('should throw when array contains non-string elements', () => {
        expect(() => validateEnv([123, 'VAR'] as any)).toThrow();
      });

      it('should throw when array contains null', () => {
        expect(() => validateEnv([null, 'VAR'] as any)).toThrow();
      });

      it('should throw when array contains undefined', () => {
        expect(() => validateEnv([undefined, 'VAR'] as any)).toThrow();
      });

      it('should throw when array contains objects', () => {
        expect(() => validateEnv([{}, 'VAR'] as any)).toThrow();
      });

      it('should throw when array contains empty string', () => {
        expect(() => validateEnv(['', 'VAR'])).toThrow();
      });

      it('should throw when array contains whitespace-only string', () => {
        expect(() => validateEnv(['   ', 'VAR'])).toThrow();
      });
    });

    describe('error messages', () => {
      it('should include all missing variable names in error message', () => {
        delete process.env.MISSING1;
        delete process.env.MISSING2;
        delete process.env.MISSING3;
        
        try {
          validateEnv(['MISSING1', 'MISSING2', 'MISSING3']);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toContain('MISSING1');
          expect(error.message).toContain('MISSING2');
          expect(error.message).toContain('MISSING3');
        }
      });

      it('should not include present variables in error message', () => {
        process.env.PRESENT = 'value';
        delete process.env.MISSING;
        
        try {
          validateEnv(['PRESENT', 'MISSING']);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).not.toContain('PRESENT');
          expect(error.message).toContain('MISSING');
        }
      });

      it('should throw clear error when no variables are provided but required', () => {
        try {
          validateEnv(null as any);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    describe('integration scenarios', () => {
      it('should work correctly when called multiple times', () => {
        process.env.VAR1 = 'value1';
        process.env.VAR2 = 'value2';
        
        expect(() => validateEnv(['VAR1', 'VAR2'])).not.toThrow();
        expect(() => validateEnv(['VAR1', 'VAR2'])).not.toThrow();
        expect(() => validateEnv(['VAR1', 'VAR2'])).not.toThrow();
      });

      it('should reflect environment changes between calls', () => {
        process.env.DYNAMIC = 'value';
        expect(() => validateEnv(['DYNAMIC'])).not.toThrow();
        
        delete process.env.DYNAMIC;
        expect(() => validateEnv(['DYNAMIC'])).toThrow();
        
        process.env.DYNAMIC = 'new-value';
        expect(() => validateEnv(['DYNAMIC'])).not.toThrow();
      });

      it('should work with getRequiredEnv and getOptionalEnv', () => {
        process.env.REQUIRED1 = 'value1';
        process.env.REQUIRED2 = 'value2';
        process.env.OPTIONAL1 = 'value3';
        
        expect(() => validateEnv(['REQUIRED1', 'REQUIRED2'])).not.toThrow();
        expect(getRequiredEnv('REQUIRED1')).toBe('value1');
        expect(getRequiredEnv('REQUIRED2')).toBe('value2');
        expect(getOptionalEnv('OPTIONAL1')).toBe('value3');
      });

      it('should validate subset of environment variables', () => {
        process.env.VAR1 = 'value1';
        process.env.VAR2 = 'value2';
        process.env.VAR3 = 'value3';
        process.env.VAR4 = 'value4';
        
        expect(() => validateEnv(['VAR1', 'VAR3'])).not.toThrow();
        expect(() => validateEnv(['VAR2', 'VAR4'])).not.toThrow();
      });

      it('should handle validation of overlapping sets', () => {
        process.env.A = 'valueA';
        process.env.B = 'valueB';
        process.env.C = 'valueC';
        
        expect(() => validateEnv(['A', 'B'])).not.toThrow();
        expect(() => validateEnv(['B', 'C'])).not.toThrow();
        expect(() => validateEnv(['A', 'C'])).not.toThrow();
      });
    });

    describe('performance and stress tests', () => {
      it('should handle validation of large number of variables efficiently', () => {
        const varCount = 1000;
        for (let i = 0; i < varCount; i++) {
          process.env[`PERF_VAR_${i}`] = `value_${i}`;
        }
        
        const varNames = Array.from({ length: varCount }, (_, i) => `PERF_VAR_${i}`);
        const startTime = Date.now();
        expect(() => validateEnv(varNames)).not.toThrow();
        const endTime = Date.now();
        
        // Should complete in reasonable time (less than 1 second for 1000 vars)
        expect(endTime - startTime).toBeLessThan(1000);
      });

      it('should handle validation with very long variable values', () => {
        const longValue = 'x'.repeat(100000);
        process.env.LONG_VALUE_VAR = longValue;
        expect(() => validateEnv(['LONG_VALUE_VAR'])).not.toThrow();
      });
    });
  });

  describe('cross-function integration tests', () => {
    it('should use all three functions together in typical workflow', () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/mydb';
      process.env.API_KEY = 'secret-key-123';
      process.env.DEBUG_MODE = 'true';
      process.env.OPTIONAL_FEATURE = 'enabled';
      
      // Validate required vars
      expect(() => validateEnv(['DATABASE_URL', 'API_KEY', 'DEBUG_MODE'])).not.toThrow();
      
      // Get required vars
      const dbUrl = getRequiredEnv('DATABASE_URL');
      const apiKey = getRequiredEnv('API_KEY');
      
      // Get optional vars
      const optionalFeature = getOptionalEnv('OPTIONAL_FEATURE', 'disabled');
      const missingFeature = getOptionalEnv('MISSING_FEATURE', 'default');
      
      expect(dbUrl).toBe('postgres://localhost:5432/mydb');
      expect(apiKey).toBe('secret-key-123');
      expect(optionalFeature).toBe('enabled');
      expect(missingFeature).toBe('default');
    });

    it('should handle mixed scenarios with some variables present and some missing', () => {
      process.env.PRESENT1 = 'value1';
      process.env.PRESENT2 = 'value2';
      delete process.env.MISSING1;
      delete process.env.MISSING2;
      
      expect(() => validateEnv(['PRESENT1', 'PRESENT2'])).not.toThrow();
      expect(getRequiredEnv('PRESENT1')).toBe('value1');
      expect(getOptionalEnv('MISSING1', 'default')).toBe('default');
      expect(() => getRequiredEnv('MISSING2')).toThrow();
    });

    it('should handle environment initialization pattern', () => {
      // Simulate loading environment variables
      const requiredVars = ['APP_NAME', 'PORT', 'NODE_ENV'];
      
      process.env.APP_NAME = 'MyApp';
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      
      // Validate all required vars at startup
      expect(() => validateEnv(requiredVars)).not.toThrow();
      
      // Load individual vars
      const appName = getRequiredEnv('APP_NAME');
      const port = getRequiredEnv('PORT');
      const nodeEnv = getRequiredEnv('NODE_ENV');
      const logLevel = getOptionalEnv('LOG_LEVEL', 'info');
      
      expect(appName).toBe('MyApp');
      expect(port).toBe('3000');
      expect(nodeEnv).toBe('development');
      expect(logLevel).toBe('info');
    });
  });

  describe('type safety and TypeScript integration', () => {
    it('should work with TypeScript type inference for required env', () => {
      process.env.TYPED_VAR = 'typed-value';
      const value: string = getRequiredEnv('TYPED_VAR');
      expect(value).toBe('typed-value');
    });

    it('should work with TypeScript type inference for optional env', () => {
      process.env.TYPED_OPTIONAL = 'typed-optional-value';
      const value: string | undefined = getOptionalEnv('TYPED_OPTIONAL');
      expect(value).toBe('typed-optional-value');
    });

    it('should work with TypeScript type inference for optional env with default', () => {
      delete process.env.TYPED_WITH_DEFAULT;
      const value: string = getOptionalEnv('TYPED_WITH_DEFAULT', 'default-value')!;
      expect(value).toBe('default-value');
    });

    it('should handle validateEnv with readonly arrays', () => {
      process.env.READONLY1 = 'value1';
      process.env.READONLY2 = 'value2';
      const vars: readonly string[] = ['READONLY1', 'READONLY2'] as const;
      expect(() => validateEnv(vars as string[])).not.toThrow();
    });
  });

  describe('real-world scenario tests', () => {
    it('should handle typical database configuration', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'myapp';
      process.env.DB_USER = 'admin';
      process.env.DB_PASSWORD = 'secret123';
      
      const dbConfig = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
      expect(() => validateEnv(dbConfig)).not.toThrow();
      
      const host = getRequiredEnv('DB_HOST');
      const port = getRequiredEnv('DB_PORT');
      const dbName = getRequiredEnv('DB_NAME');
      const sslMode = getOptionalEnv('DB_SSL_MODE', 'prefer');
      
      expect(host).toBe('localhost');
      expect(port).toBe('5432');
      expect(dbName).toBe('myapp');
      expect(sslMode).toBe('prefer');
    });

    it('should handle API service configuration', () => {
      process.env.API_BASE_URL = 'https://api.example.com';
      process.env.API_KEY = 'key-12345';
      process.env.API_TIMEOUT = '30000';
      process.env.API_RETRY_COUNT = '3';
      
      expect(() => validateEnv(['API_BASE_URL', 'API_KEY'])).not.toThrow();
      
      const baseUrl = getRequiredEnv('API_BASE_URL');
      const apiKey = getRequiredEnv('API_KEY');
      const timeout = getOptionalEnv('API_TIMEOUT', '5000');
      const retryCount = getOptionalEnv('API_RETRY_COUNT', '1');
      const rateLimit = getOptionalEnv('API_RATE_LIMIT');
      
      expect(baseUrl).toBe('https://api.example.com');
      expect(apiKey).toBe('key-12345');
      expect(timeout).toBe('30000');
      expect(retryCount).toBe('3');
      expect(rateLimit).toBeUndefined();
    });

    it('should handle AWS credentials configuration', () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      
      const awsVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
      expect(() => validateEnv(awsVars)).not.toThrow();
      
      const region = getRequiredEnv('AWS_REGION');
      const accessKeyId = getRequiredEnv('AWS_ACCESS_KEY_ID');
      const sessionToken = getOptionalEnv('AWS_SESSION_TOKEN');
      
      expect(region).toBe('us-east-1');
      expect(accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(sessionToken).toBeUndefined();
    });

    it('should handle feature flags configuration', () => {
      process.env.FEATURE_NEW_UI = 'true';
      process.env.FEATURE_BETA_API = 'false';
      process.env.FEATURE_ANALYTICS = 'enabled';
      
      const newUI = getOptionalEnv('FEATURE_NEW_UI', 'false');
      const betaAPI = getOptionalEnv('FEATURE_BETA_API', 'false');
      const analytics = getOptionalEnv('FEATURE_ANALYTICS', 'disabled');
      const darkMode = getOptionalEnv('FEATURE_DARK_MODE', 'auto');
      
      expect(newUI).toBe('true');
      expect(betaAPI).toBe('false');
      expect(analytics).toBe('enabled');
      expect(darkMode).toBe('auto');
    });

    it('should handle multi-environment deployment configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.APP_VERSION = '1.2.3';
      process.env.BUILD_NUMBER = '456';
      process.env.DEPLOY_REGION = 'us-west-2';
      
      expect(() => validateEnv(['NODE_ENV'])).not.toThrow();
      
      const env = getRequiredEnv('NODE_ENV');
      const version = getOptionalEnv('APP_VERSION', '0.0.0');
      const buildNumber = getOptionalEnv('BUILD_NUMBER', 'local');
      const region = getOptionalEnv('DEPLOY_REGION', 'us-east-1');
      
      expect(env).toBe('production');
      expect(version).toBe('1.2.3');
      expect(buildNumber).toBe('456');
      expect(region).toBe('us-west-2');
    });
  });
});