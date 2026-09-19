import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { RouteError } from './components/RouteError'
import { Home } from './routes/Home'
import { ListDetail } from './routes/ListDetail'
import { Search } from './routes/Search'
import { SharedList } from './routes/SharedList'
import { Today } from './routes/Today'

// Every route is registered here. One file per screen in src/routes/.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'lists/:listId', element: <ListDetail /> },
      { path: 'today', element: <Today /> },
      { path: 'search', element: <Search /> },
    ],
  },
  // Outside the shell: a shared list's public page shows no sign-in screen to a signed-out visitor.
  { path: '/share/:listId', element: <SharedList />, errorElement: <RouteError /> },
])
