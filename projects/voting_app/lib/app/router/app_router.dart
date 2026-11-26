import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:voting_app/features/auth/presentation/pages/home_page.dart';
import 'package:voting_app/features/auth/presentation/pages/login_page.dart';
import 'package:voting_app/features/auth/presentation/pages/splash_screen.dart';
import 'package:voting_app/features/elections/presentation/pages/election_page.dart';

import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_state.dart';
import 'app_routes.dart';

class AppRouter {
  final AuthBloc authBloc;

  late final GoRouter router;
  late final GoRouterRefreshStream _refreshStream;

  AppRouter(this.authBloc) {
    _refreshStream = GoRouterRefreshStream(authBloc.stream);

    router = GoRouter(
      initialLocation: AppRoutes.splash,
      refreshListenable: _refreshStream,
      routes: [
        GoRoute(
          path: AppRoutes.splash,
          builder: (context, state) => const SplashPage(),
        ),
        GoRoute(
          path: AppRoutes.login,
          builder: (context, state) => const LoginPage(),
        ),
        GoRoute(
          path: AppRoutes.register,
          builder: (context, state) => const RegisterPage(),
        ),
        GoRoute(
          path: AppRoutes.home,
          builder: (context, state) => const HomePage(),
        ),
        GoRoute(
          path: AppRoutes.elections,
          builder: (context, state) => const ElectionsPage(),
        ),
      ],
      redirect: (context, state) {
        final authState = authBloc.state;
        final location = state.matchedLocation;

        final isSplash = location == AppRoutes.splash;
        final isLogin = location == AppRoutes.login;
        final isRegister = location == AppRoutes.register;
        final isPublicRoute = isLogin || isRegister;

        if (authState is AuthInitial || authState is AuthChecking) {
          return isSplash ? null : AppRoutes.splash;
        }

        if (authState is Authenticated) {
          return isPublicRoute || isSplash ? AppRoutes.home : null;
        }

        if (authState is Unauthenticated || authState is AuthFailure) {
          return isPublicRoute ? null : AppRoutes.login;
        }

        return null;
      },
    );
  }

  void dispose() {
    router.dispose();
    _refreshStream.dispose();
  }
}

class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    _subscription = stream.listen((_) {
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
