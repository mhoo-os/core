import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import defaultRole from 'src/default-role';
import { describe, expect, it } from 'vitest';

describe('application identifiers', () => {
  it('should expose the application metadata constants', () => {
    expect(APP_DISPLAY_NAME).toBeTruthy();
    expect(typeof APP_DESCRIPTION).toBe('string');
    expect(APPLICATION_UNIVERSAL_IDENTIFIER).toBeTruthy();
  });

  it('defines a non-broad application role for function execution', () => {
    expect(defaultRole.config.canReadAllObjectRecords).toBe(false);
    expect(defaultRole.config.canUpdateAllObjectRecords).toBe(false);
    expect(defaultRole.config.objectPermissions).toHaveLength(3);
    expect(defaultRole.config.canBeAssignedToUsers).toBe(false);
    expect(defaultRole.config.canBeAssignedToApiKeys).toBe(false);
  });
});
