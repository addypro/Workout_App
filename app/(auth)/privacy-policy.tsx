/**
 * Privacy Policy Page
 * 
 * Basic privacy policy placeholder - to be updated with actual policy content.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Information We Collect</Text>
                    <Text style={styles.sectionText}>
                        We collect information you provide directly to us, including:
                    </Text>
                    <Text style={styles.bulletPoint}>• Account information (email, name)</Text>
                    <Text style={styles.bulletPoint}>• Workout data (exercises, sets, reps, weight)</Text>
                    <Text style={styles.bulletPoint}>• Performance metrics and progress</Text>
                    <Text style={styles.bulletPoint}>• Device and usage information</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
                    <Text style={styles.sectionText}>
                        We use the information we collect to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Provide and improve our services</Text>
                    <Text style={styles.bulletPoint}>• Track your workout progress</Text>
                    <Text style={styles.bulletPoint}>• Enable social features and competitions</Text>
                    <Text style={styles.bulletPoint}>• Send you relevant notifications</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Data Security</Text>
                    <Text style={styles.sectionText}>
                        We implement industry-standard security measures to protect your data.
                        Your workout data is encrypted in transit and at rest. We never sell
                        your personal information to third parties.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Your Rights</Text>
                    <Text style={styles.sectionText}>
                        You have the right to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Access your personal data</Text>
                    <Text style={styles.bulletPoint}>• Request data deletion</Text>
                    <Text style={styles.bulletPoint}>• Export your workout history</Text>
                    <Text style={styles.bulletPoint}>• Opt out of marketing communications</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Contact Us</Text>
                    <Text style={styles.sectionText}>
                        If you have any questions about this Privacy Policy, please contact us
                        at privacy@antigravity.app
                    </Text>
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
    },
    lastUpdated: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: Spacing.xl,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: Spacing.sm,
    },
    sectionText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#9CA3AF',
        marginBottom: Spacing.sm,
    },
    bulletPoint: {
        fontSize: 15,
        lineHeight: 24,
        color: '#9CA3AF',
        paddingLeft: Spacing.md,
    },
    bottomPadding: {
        height: Platform.OS === 'ios' ? 40 : 60,
    },
});
