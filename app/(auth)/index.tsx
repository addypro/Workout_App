/**
 * Auth Index Redirect
 * 
 * Ensures navigating to /(auth) lands on the landing page.
 */

import { Redirect } from 'expo-router';

export default function AuthIndex() {
    return <Redirect href="/(auth)/landing" />;
}
