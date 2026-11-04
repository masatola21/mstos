import React from 'react';
import { Package, FolderGit2, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { ProductHubView } from './ProductHubView';
import { ProjectsView } from '../ai-president/ProjectsView';
import { ManagedProduct, ManagedContract, ManagedInvoice, ManagedToolAsset } from '../../types/matrix';
import { Project, TaskItem, CharacterConfig, UserProfile, ApiUsageData } from '../../types/ai-president';

interface ProductProjectHubProps {
  activeTab: 'product_hub' | 'ai_projects';
  onTabChange: (tab: 'product_hub' | 'ai_projects') => void;
  // ProductHubView props
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  tasks: TaskItem[];
  projects: Project[];
  onAddProduct: (product: Omit<ManagedProduct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onUpdateProduct: (id: string, updates: Partial<ManagedProduct>) => void;
  onReorderProducts?: (reorderedProducts: ManagedProduct[]) => void;
  onDeleteProduct?: (id: string, archive: boolean, force?: boolean) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onRestoreProduct?: (id: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onPublishProduct: (product: ManagedProduct, fees: { initialFee: number; monthlyFee: number }) => Promise<void>;
  onAddProjectWithTasks?: (project: Project, tasks: TaskItem[]) => void;
  onRecordUsage?: (params: { endpoint: 'chat'; endpointName: string; model?: string; usage: ApiUsageData }) => void;
  character?: CharacterConfig;
  userProfile?: UserProfile;
  // ProjectsView props
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void | Promise<void>;
  onNavigateToTasksWithFilter: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ProductProjectHub: React.FC<ProductProjectHubProps> = ({
  activeTab,
  onTabChange,
  products,
  contracts,
  invoices,
  tools,
  tasks,
  projects,
  onAddProduct,
  onUpdateProduct,
  onReorderProducts,
  onDeleteProduct,
  onRestoreProduct,
  onPublishProduct,
  onAddProjectWithTasks,
  onRecordUsage,
  character,
  userProfile,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onNavigateToTasksWithFilter,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-4">
      {/* 統合ナビゲーションタブ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* タブ切り替えボタン */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onTabChange('product_hub')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'product_hub'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Package className={`h-4 w-4 ${activeTab === 'product_hub' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>商品開発・ロードマップ</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'product_hub'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                企画・仕様設計
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('ai_projects')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai_projects'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FolderGit2 className={`h-4 w-4 ${activeTab === 'ai_projects' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>プロジェクト管理</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'ai_projects'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                工程・進捗
              </span>
            </button>
          </div>

          {/* 右側：共通タスクへのクイックショートカット */}
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden md:flex">
            <span className="text-[11px] text-slate-400">
              {activeTab === 'product_hub'
                ? '商品仕様やロードマップを策定し、開発プロジェクトを起動'
                : 'プロジェクトのマイルストーンを管理し、全社タスクへ展開'}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('ai_tasks')}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>共通タスク・承認へ</span>
            </button>
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'product_hub' ? (
          <ProductHubView
            products={products}
            contracts={contracts}
            invoices={invoices}
            tools={tools}
            tasks={tasks}
            projects={projects}
            character={character}
            userProfile={userProfile}
            onAddProduct={onAddProduct}
            onUpdateProduct={onUpdateProduct}
            onReorderProducts={onReorderProducts}
            onDeleteProduct={onDeleteProduct}
            onRestoreProduct={onRestoreProduct}
            onPublishProduct={onPublishProduct}
            onRecordUsage={onRecordUsage}
            onAddProjectWithTasks={onAddProjectWithTasks}
          />
        ) : (
          <ProjectsView
            projects={projects}
            tasks={tasks}
            onCreateProject={onCreateProject}
            onUpdateProject={onUpdateProject}
            onDeleteProject={onDeleteProject}
            onNavigateToTasksWithFilter={onNavigateToTasksWithFilter}
          />
        )}
      </div>
    </div>
  );
};
