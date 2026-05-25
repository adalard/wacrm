'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, MessageSquare, Tag, User, Terminal, CreditCard, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { DeveloperApiManager } from '@/components/settings/developer-api';
import { TeammatesManager } from '@/components/settings/teammates';
import { BillingManager } from '@/components/settings/billing';
import { useAuth } from '@/hooks/use-auth';

const TAB_VALUES = ['profile', 'whatsapp', 'templates', 'tags', 'teammates', 'developer', 'billing'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole } = useAuth();
  
  const isTeammate = userRole === 'sales_rep' || userRole === 'support_agent';

  // The URL is the single source of truth for the active tab
  const queryTab = searchParams.get('tab');
  const tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  // Guard: Automatically redirect teammates who try to access forbidden settings tabs back to Profile settings
  useEffect(() => {
    if (isTeammate && (tab === 'billing' || tab === 'developer' || tab === 'whatsapp')) {
      onChange('profile');
    }
  }, [isTeammate, tab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          {isTeammate 
            ? 'Manage your personal profile, credentials, active sessions, templates, and tags.' 
            : 'Manage your profile, WhatsApp® integration, message templates, tags, teammates, and billing plans.'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => onChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger
            value="profile"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <User className="size-4" />
            Profile
          </TabsTrigger>
          
          {!isTeammate && (
            <TabsTrigger
              value="whatsapp"
              className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
            >
              <Settings className="size-4" />
              WhatsApp Config
            </TabsTrigger>
          )}

          <TabsTrigger
            value="templates"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <MessageSquare className="size-4" />
            Templates
          </TabsTrigger>
          
          <TabsTrigger
            value="tags"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Tag className="size-4" />
            Tags
          </TabsTrigger>
          
          <TabsTrigger
            value="teammates"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Users className="size-4" />
            Teammates
          </TabsTrigger>
          
          {!isTeammate && (
            <TabsTrigger
              value="developer"
              className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
            >
              <Terminal className="size-4" />
              Developer API
            </TabsTrigger>
          )}

          {!isTeammate && (
            <TabsTrigger
              value="billing"
              className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
            >
              <CreditCard className="size-4" />
              Billing & Plans
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </TabsContent>

        {!isTeammate && (
          <TabsContent value="whatsapp">
            <WhatsAppConfig />
          </TabsContent>
        )}

        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="teammates">
          <TeammatesManager />
        </TabsContent>

        {!isTeammate && (
          <TabsContent value="developer">
            <DeveloperApiManager />
          </TabsContent>
        )}

        {!isTeammate && (
          <TabsContent value="billing">
            <BillingManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
