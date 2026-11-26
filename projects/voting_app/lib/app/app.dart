import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:voting_app/app/router/app_router.dart';

import '../core/di/injection_container.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/auth/presentation/bloc/auth_event.dart';

class VoteSphereApp extends StatefulWidget {
  const VoteSphereApp({super.key});

  @override
  State<VoteSphereApp> createState() => _VoteSphereAppState();
}

class _VoteSphereAppState extends State<VoteSphereApp> {
  late final AuthBloc _authBloc;
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();

    _authBloc = sl<AuthBloc>()..add(const AuthCheckRequested());

    _appRouter = AppRouter(_authBloc);
  }

  @override
  void dispose() {
    _appRouter.dispose();
    _authBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _authBloc,
      child: MaterialApp.router(
        title: 'VoteSphere',
        debugShowCheckedModeBanner: false,
        routerConfig: _appRouter.router,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
          useMaterial3: true,
        ),
      ),
    );
  }
}
