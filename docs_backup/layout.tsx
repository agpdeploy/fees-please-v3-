import { Layout, Navbar, Footer } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

// This function drills into every folder and fixes the routes
function fixPageMap(map: any[]): any[] {
  return map.map((item) => {
    const newItem = { ...item }
    
    // Force the route to match the /docs/... URL structure
    if (newItem.route === '/') {
      newItem.route = '/docs'
    } else if (newItem.route && !newItem.route.startsWith('/docs')) {
      newItem.route = `/docs${newItem.route}`
    }

    // Do the same for all sub-pages/folders
    if (newItem.children) {
      newItem.children = fixPageMap(newItem.children)
    }
    
    return newItem
  })
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  // 1. Get the map for the content/docs folder
  const rawPageMap = await getPageMap('/docs')
  
  // 2. Apply the recursive fix
  const pageMap = fixPageMap(rawPageMap)

  return (
    <Layout
      navbar={
        <Navbar 
          logo={
            <div className="fees-please-logo flex items-center gap-2">
              <b className="text-lg text-zinc-900 dark:text-white">Fees Please</b>
              <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">SSOT</span>
            </div>
          }
        />
      }
      pageMap={pageMap}
      sidebar={{
        defaultMenuCollapseLevel: 1,
        autoCollapse: false,
      }}
      footer={
        <Footer>
          <div className="text-sm opacity-50">
            {new Date().getFullYear()} © Fees Please
          </div>
        </Footer>
      }
    >
      {children}
    </Layout>
  )
}