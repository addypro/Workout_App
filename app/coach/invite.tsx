/**
 * Invite Athletes Screen
 *
 * Coaches can invite athletes via:
 * - Code: Quick 8-character code
 * - Link: Shareable URL
 * - Email: Direct invitation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/context/auth-context';
import {
  createCodeInvite,
  createLinkInvite,
  createEmailInvite,
  getMyInvites,
  deactivateInvite,
  getInviteUrl,
  CoachInvite,
  canAddAthlete,
  InviteMethod as InviteMethodEnum,
} from '@/lib/services/coach';

type InviteMethod = 'code' | 'link' | 'email';

// DEV MODE: Check if using mock user (no real Supabase session)
const isDevMockUser = (userId?: string) => {
  return __DEV__ && userId?.startsWith('dev-');
};

// Generate mock invite for dev mode
const generateMockInvite = (type: InviteMethod): CoachInvite => ({
  id: `mock-${Date.now()}`,
  coachId: 'dev-coach-123',
  inviteType: type === 'code' ? InviteMethodEnum.CODE : type === 'link' ? InviteMethodEnum.LINK : InviteMethodEnum.EMAIL,
  inviteCode: `DEV${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
  inviteLinkToken: type === 'link' ? `mock-token-${Date.now()}` : undefined,
  email: type === 'email' ? 'athlete@test.dev' : undefined,
  maxUses: type === 'link' ? 999 : 1,
  currentUses: 0,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  isActive: true,
  createdAt: new Date(),
});

export default function InviteAthletesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const isDevMode = isDevMockUser(user?.id);

  const [activeMethod, setActiveMethod] = useState<InviteMethod>('code');
  const [email, setEmail] = useState('');
  const [currentInvite, setCurrentInvite] = useState<CoachInvite | null>(null);
  const [recentInvites, setRecentInvites] = useState<CoachInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canInvite, setCanInvite] = useState(true);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isDevMode) {
      // Dev mode: skip API calls, use mock data
      setCanInvite(true);
      setLimitMessage(null);
      return;
    }
    checkLimit();
    loadRecentInvites();
  }, [isDevMode]);

  const checkLimit = async () => {
    const result = await canAddAthlete();
    if (result.data) {
      setCanInvite(result.data.canAdd);
      setLimitMessage(result.data.reason || null);
    }
  };

  const loadRecentInvites = async () => {
    const result = await getMyInvites(1, 5);
    if (result.success && result.data) {
      setRecentInvites(result.data.data);
    }
  };

  const handleGenerateCode = async () => {
    setIsLoading(true);
    try {
      // Dev mode: generate mock invite
      if (isDevMode) {
        const mockInvite = generateMockInvite('code');
        setCurrentInvite(mockInvite);
        setRecentInvites(prev => [mockInvite, ...prev].slice(0, 5));
        setIsLoading(false);
        return;
      }

      const result = await createCodeInvite();
      if (result.success && result.data) {
        setCurrentInvite(result.data);
        loadRecentInvites();
      } else {
        Alert.alert('Error', result.error || 'Failed to generate code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invite code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      // Dev mode: generate mock invite
      if (isDevMode) {
        const mockInvite = generateMockInvite('link');
        setCurrentInvite(mockInvite);
        setRecentInvites(prev => [mockInvite, ...prev].slice(0, 5));
        setIsLoading(false);
        return;
      }

      const result = await createLinkInvite();
      if (result.success && result.data) {
        setCurrentInvite(result.data);
        loadRecentInvites();
      } else {
        Alert.alert('Error', result.error || 'Failed to generate link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invite link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Dev mode: generate mock invite
      if (isDevMode) {
        const mockInvite = generateMockInvite('email');
        mockInvite.email = email;
        setCurrentInvite(mockInvite);
        setEmail('');
        setRecentInvites(prev => [mockInvite, ...prev].slice(0, 5));
        Alert.alert('Invite Sent (Dev Mode)', `Mock invitation sent to ${email}`);
        setIsLoading(false);
        return;
      }

      const result = await createEmailInvite(email);
      if (result.success && result.data) {
        setCurrentInvite(result.data);
        setEmail('');
        loadRecentInvites();
        Alert.alert('Invite Sent', `Invitation sent to ${email}`);
      } else {
        Alert.alert('Error', result.error || 'Failed to send invite');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send email invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (currentInvite?.inviteCode) {
      await Clipboard.setStringAsync(currentInvite.inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleShareLink = async () => {
    if (currentInvite) {
      const url = getInviteUrl(currentInvite);
      try {
        await Share.share({
          message: `Join me on Workout App! Use this link to get started: ${url}`,
          url,
        });
      } catch (error) {
        // User cancelled
      }
    }
  };

  const handleDeactivate = async (inviteId: string) => {
    Alert.alert(
      'Deactivate Invite',
      'This invite will no longer work. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            // Dev mode: just remove from local state
            if (isDevMode) {
              setRecentInvites(prev => prev.filter(i => i.id !== inviteId));
              if (currentInvite?.id === inviteId) {
                setCurrentInvite(null);
              }
              return;
            }

            await deactivateInvite(inviteId);
            loadRecentInvites();
            if (currentInvite?.id === inviteId) {
              setCurrentInvite(null);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/coach');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Platform.OS === 'ios' ? 8 : Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerTitle: {
      ...Typography.headline,
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.groupedBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingTop: Spacing.sm,
    },
    // Dev mode banner
    devBanner: {
      backgroundColor: '#FF950020',
      borderWidth: 1,
      borderColor: '#FF9500',
      borderStyle: 'dashed',
      padding: Spacing.md,
      borderRadius: Radius.md,
      marginBottom: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    devBannerText: {
      ...Typography.footnote,
      color: '#FF9500',
      marginLeft: Spacing.sm,
      flex: 1,
    },
    // Limit Warning
    limitWarning: {
      backgroundColor: '#FF453A20',
      padding: Spacing.md,
      borderRadius: Radius.md,
      marginBottom: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    limitWarningText: {
      ...Typography.subhead,
      color: '#FF453A',
      marginLeft: Spacing.sm,
      flex: 1,
    },
    // Method Tabs
    methodTabs: {
      flexDirection: 'row',
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.md,
      padding: 4,
      marginBottom: Spacing.lg,
    },
    methodTab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      borderRadius: Radius.sm,
    },
    methodTabActive: {
      backgroundColor: colors.background,
    },
    methodTabText: {
      ...Typography.subhead,
      color: colors.textSecondary,
    },
    methodTabTextActive: {
      color: colors.tint,
      fontWeight: '600',
    },
    // Content Section
    section: {
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    sectionSubtitle: {
      ...Typography.footnote,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    // Code Display
    codeContainer: {
      backgroundColor: colors.background,
      borderRadius: Radius.md,
      padding: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    codeText: {
      ...Typography.title1,
      color: colors.text,
      fontWeight: '700',
      letterSpacing: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    codeExpiry: {
      ...Typography.caption1,
      color: colors.textTertiary,
      marginTop: Spacing.xs,
    },
    // Buttons
    primaryButton: {
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      ...Typography.headline,
      color: '#FFFFFF',
    },
    secondaryButton: {
      backgroundColor: colors.background,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    secondaryButtonText: {
      ...Typography.headline,
      color: colors.tint,
    },
    // Email Input
    emailInput: {
      ...Typography.body,
      backgroundColor: colors.background,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    // Recent Invites
    recentTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      padding: Spacing.md,
      borderRadius: Radius.md,
      marginBottom: Spacing.sm,
    },
    inviteIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    inviteInfo: {
      flex: 1,
    },
    inviteCode: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    inviteMeta: {
      ...Typography.caption1,
      color: colors.textSecondary,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    inviteActionButton: {
      padding: Spacing.xs,
    },
  });

  const renderCodeSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quick Invite Code</Text>
      <Text style={styles.sectionSubtitle}>
        Generate a code that athletes can enter to join you
      </Text>

      {currentInvite && activeMethod === 'code' ? (
        <>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{currentInvite.inviteCode}</Text>
            <Text style={styles.codeExpiry}>
              Expires {currentInvite.expiresAt.toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Copy Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGenerateCode}>
            <Text style={styles.secondaryButtonText}>Generate New Code</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.primaryButton, (!canInvite || isLoading) && styles.primaryButtonDisabled]}
          onPress={handleGenerateCode}
          disabled={!canInvite || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="key-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Generate Code</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLinkSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Shareable Link</Text>
      <Text style={styles.sectionSubtitle}>
        Create a link you can share on social media or messaging apps
      </Text>

      {currentInvite && currentInvite.inviteLinkToken && activeMethod === 'link' ? (
        <>
          <View style={styles.codeContainer}>
            <Ionicons name="link" size={32} color={colors.tint} />
            <Text style={[styles.codeExpiry, { marginTop: Spacing.sm }]}>
              Link ready to share • {currentInvite.currentUses}/{currentInvite.maxUses} uses
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleShareLink}>
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Share Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGenerateLink}>
            <Text style={styles.secondaryButtonText}>Generate New Link</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.primaryButton, (!canInvite || isLoading) && styles.primaryButtonDisabled]}
          onPress={handleGenerateLink}
          disabled={!canInvite || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="link-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Create Link</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmailSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Email Invite</Text>
      <Text style={styles.sectionSubtitle}>
        Send a direct invitation to a specific athlete
      </Text>

      <TextInput
        style={styles.emailInput}
        placeholder="athlete@example.com"
        placeholderTextColor={colors.textTertiary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (!canInvite || !email.includes('@') || isLoading) && styles.primaryButtonDisabled,
        ]}
        onPress={handleSendEmail}
        disabled={!canInvite || !email.includes('@') || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Send Invite</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const getInviteIcon = (type: string) => {
    switch (type) {
      case 'code':
        return 'key-outline';
      case 'link':
        return 'link-outline';
      case 'email':
        return 'mail-outline';
      default:
        return 'paper-plane-outline';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invite Athletes</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dev mode banner */}
        {isDevMode && (
          <View style={styles.devBanner}>
            <Ionicons name="construct-outline" size={18} color="#FF9500" />
            <Text style={styles.devBannerText}>
              Dev Mode: Using mock data. Invites won't be saved to database.
            </Text>
          </View>
        )}

        {!canInvite && limitMessage && (
          <View style={styles.limitWarning}>
            <Ionicons name="warning" size={20} color="#FF453A" />
            <Text style={styles.limitWarningText}>{limitMessage}</Text>
          </View>
        )}

        {/* Method Tabs */}
        <View style={styles.methodTabs}>
          {(['code', 'link', 'email'] as InviteMethod[]).map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.methodTab, activeMethod === method && styles.methodTabActive]}
              onPress={() => setActiveMethod(method)}
            >
              <Text
                style={[
                  styles.methodTabText,
                  activeMethod === method && styles.methodTabTextActive,
                ]}
              >
                {method.charAt(0).toUpperCase() + method.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active Method Section */}
        {activeMethod === 'code' && renderCodeSection()}
        {activeMethod === 'link' && renderLinkSection()}
        {activeMethod === 'email' && renderEmailSection()}

        {/* Recent Invites */}
        {recentInvites.length > 0 && (
          <>
            <Text style={styles.recentTitle}>Recent Invites</Text>
            {recentInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteRow}>
                <View style={styles.inviteIcon}>
                  <Ionicons
                    name={getInviteIcon(invite.inviteType) as any}
                    size={18}
                    color={colors.tint}
                  />
                </View>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteCode}>
                    {invite.inviteType === 'email' ? invite.email : invite.inviteCode}
                  </Text>
                  <Text style={styles.inviteMeta}>
                    {invite.currentUses}/{invite.maxUses} used •{' '}
                    {invite.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  {invite.isActive && (
                    <TouchableOpacity
                      style={styles.inviteActionButton}
                      onPress={() => handleDeactivate(invite.id)}
                    >
                      <Ionicons name="close-circle-outline" size={24} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
