import { describe, expect, it } from 'vitest';
import { users } from './users.js';

describe('users', () => {
    it('includes the admin credentials', () => {
        expect(users).toContainEqual({email: 'admin@admin.com', password: '2020'});
    });
});