import { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Dashboard } from './pages/Dashboard';
import { ApprovalWorkbench } from './pages/ApprovalWorkbench';
import { InquiryMatching } from './pages/InquiryMatching';
import { MappingWorkbench } from './pages/MappingWorkbench';
import { ProductCatalog } from './pages/ProductCatalog';
import { ProductModels } from './pages/ProductModels';
import { ProductBom } from './pages/ProductBom';
import { FeaturesPage } from './pages/FeaturesPage';
import { RulesPage } from './pages/RulesPage';
import { ForwardConfig } from './pages/ForwardConfig';
import { ReverseConfig } from './pages/ReverseConfig';
import { QuotationList } from './pages/QuotationList';
import { CpqQuotation } from './pages/CpqQuotation';
import { roleViewMap } from './data/roleViews';
import { useAppStore } from './store/appStore';

function PageRouter() {
  const { activeTab, currentRole, setActiveTab } = useAppStore();
  const roleInfo = roleViewMap[currentRole];

  useEffect(() => {
    if (!roleInfo.allowedTabs.includes(activeTab)) {
      setActiveTab(roleInfo.defaultTab);
    }
  }, [activeTab, currentRole, roleInfo, setActiveTab]);

  if (!roleInfo.allowedTabs.includes(activeTab)) {
    return null;
  }

  switch (activeTab) {
    case 'dashboard': return <Dashboard />;
    case 'approval-workbench': return <ApprovalWorkbench />;
    case 'inquiry-matching': return <InquiryMatching />;
    case 'mapping-workbench': return <MappingWorkbench />;
    case 'products-catalog': return <ProductCatalog />;
    case 'products-models': return <ProductModels />;
    case 'products-bom': return <ProductBom />;
    case 'features': return <FeaturesPage />;
    case 'rules': return <RulesPage />;
    case 'configurator-forward': return <ForwardConfig />;
    case 'configurator-reverse': return <ReverseConfig />;
    case 'quotations-list': return <QuotationList />;
    case 'quotations-cpq': return <CpqQuotation />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const { activeTab } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar activeTab={activeTab} />
        <main className="flex-1 overflow-y-auto">
          <PageRouter />
        </main>
      </div>
    </div>
  );
}
