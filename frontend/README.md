# Paracal Frontend

A modern, responsive React application for calendar and employee management with a beautiful UI built using shadcn/ui components.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## 📊 Tech Stack

- **Framework**: [React 18](https://react.dev) with TypeScript
- **Build Tool**: [Vite](https://vitejs.dev) - Fast development and build
- **UI Components**: [shadcn/ui](https://ui.shadcn.com) - Beautiful, accessible components
- **Styling**: [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- **Icons**: [Lucide React](https://lucide.dev) - Beautiful icons
- **State Management**: React Query for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: Moment.js with timezone support

## 🎨 UI Components

Built with **shadcn/ui** components:
- Calendar grids and date pickers
- Modal dialogs and popovers
- Form inputs and validation
- Tables and data displays
- Navigation and layouts
- Toast notifications
- Loading states and skeletons

## 📱 Features

### 🏠 Dashboard
- Overview of upcoming events
- Employee statistics
- Leave statistics
- Quick actions

### 👥 Employee Management
- Employee list with search and filters
- Add/edit/delete employees
- Employee details modal
- Role-based access display

### 📅 Calendar Events
- Interactive calendar grid
- Create/edit/delete events
- Event details modal
- Date range filtering
- Event type categorization

### 🎄 Holiday Management
- Company holiday tracking
- Holiday calendar integration
- Add/remove holidays

### ⚙️ Cronjob Configuration
- Scheduled notification management
- Notification settings
- Cron job status monitoring

## 📁 Project Structure

- `src/components/` - React components including shadcn/ui
- `src/pages/` - Page-level components and routing
- `src/services/` - API clients and data services
- `src/hooks/` - Custom React hooks
- `public/` - Static assets
- `Dockerfile` - Container definition

## 🎯 Pages & Routes

- `/` - Dashboard overview
- `/employees` - Employee management
- `/calendar` - Calendar events view
- `/cronjobs` - Cronjob configuration
- `*` - 404 Not Found page

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for local development:
```bash
VITE_API_BASE_URL=http://localhost:3000
```

### API Integration
- Base URL: Configured via environment variables
- Backend communication through `/api` proxy (in production)
- Type-safe API calls with TypeScript

## 🎨 Theming

- **Light/Dark mode** support via next-themes
- **Tailwind CSS** for styling
- **CSS variables** for theme colors
- **Responsive design** for all screen sizes

## 📱 Responsive Design

- **Desktop**: Full feature set with sidebar navigation
- **Tablet**: Adapted layouts with collapsible elements
- **Mobile**: Mobile-first responsive design
- **Touch-friendly**: Optimized for touch interactions

## 🔄 State Management

- **React Query**: Server state, caching, and synchronization
- **React Context**: Theme and global state
- **Local State**: Component-level state with hooks
- **Form State**: React Hook Form for complex forms

## 🧪 Development

### Hot Reload
- Vite provides instant hot module replacement
- TypeScript checking in development
- ESLint integration for code quality

### Code Quality
```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint --fix

# Type checking
npx tsc --noEmit
```

## 🐳 Docker

The frontend is containerized with Nginx for production:

```bash
# Build the app first
npm run build

# Build container
docker build -t calendar-frontend .

# Run container
docker run -p 80:80 calendar-frontend

# Using docker-compose (recommended)
docker-compose up frontend
```

### Nginx Configuration
- Serves static React build files
- SPA routing support with fallback to index.html
- API proxy to backend at `/api/*`
- Optimized for production serving

## 🚀 Performance

- **Vite**: Lightning-fast development builds
- **Code Splitting**: Automatic route-based code splitting
- **Tree Shaking**: Dead code elimination
- **Asset Optimization**: Automatic image and CSS optimization
- **Lazy Loading**: Component-level lazy loading
- **Caching**: Browser caching optimization

## 📚 Component Library

### Form Components
- Input fields with validation
- Select dropdowns
- Date pickers
- Checkboxes and switches

### Display Components
- Data tables with sorting
- Cards and layouts
- Badges and status indicators
- Progress indicators

### Navigation
- Responsive navbar
- Breadcrumb navigation
- Sidebar navigation
- Modal dialogs

## 🎭 Accessibility

- **ARIA labels** and semantic HTML
- **Keyboard navigation** support
- **Screen reader** compatibility
- **Focus management** in modals
- **Color contrast** compliance

## 🤝 Development Workflow

1. **Start development server**: `npm run dev`
2. **Make changes**: Auto-reload on save
3. **Check types**: TypeScript validation
4. **Lint code**: ESLint checks
5. **Build for production**: `npm run build`
6. **Test production build**: `npm run preview`

---

Built with ❤️ using modern React and TypeScript